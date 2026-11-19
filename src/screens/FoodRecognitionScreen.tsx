import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  Dimensions,
  Platform,
  ActivityIndicator,
  Modal,
  Linking,
  Animated,
  StatusBar,
} from "react-native";
import { Camera, CameraType } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../config/firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { subscriptionService } from "../services/subscription-service";
import { LinearGradient } from "expo-linear-gradient";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import TensorFlowLoader from "../components/TensorFlowLoader";
import TensorFlowFoodRecognitionService from '../services/tensorflow-food-recognition-service';
import { analyticsService } from "../services/analytics-service";
import { recognizeFood, FoodRecognitionResult } from '../services/clarifai-food-service';

const { width } = Dimensions.get("window");

/**
 * Validates an image to ensure it's suitable for food recognition
 * @param imageUri URI of the image to check
 * @returns Object with validation result and reason if invalid
 */
const validateImage = async (imageUri: string): Promise<{ valid: boolean; reason?: string }> => {
  try {
    // First check if file exists
    const fileInfo = await FileSystem.getInfoAsync(imageUri);
    if (!fileInfo.exists) {
      return { valid: false, reason: "Image file doesn't exist" };
    }
    
    // If image is too small, it's probably not valid
    if (fileInfo.size < 5000) { // Less than 5KB
      return { valid: false, reason: "Image is too small to contain food" };
    }
    
    // For more advanced validation, we would analyze image content
    // This is a simple check that can be expanded later
    return { valid: true };
  } catch (error) {
    console.error("Error validating image:", error);
    return { valid: false, reason: "Failed to validate image" };
  }
};

// Safe Text Component to prevent rendering errors
const SafeText = ({ children, style = {} }) => {
  // Convert any value to a safe string
  const safeChildren = 
    typeof children === 'string' ? children : 
    children !== null && children !== undefined ? String(children) : '';
  
  return <Text style={style}>{safeChildren}</Text>;
};

const FoodRecognitionScreen = ({ navigation }) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [camera, setCamera] = useState<Camera | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [scansLeft, setScansLeft] = useState(10);
  const [loadingMessage, setLoadingMessage] = useState("Analyzing your food...");
  const [showResults, setShowResults] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [detectedFood, setDetectedFood] = useState<{
    name: string;
    description: string;
    ingredients: string[];
    culturalInfo: string;
    confidence: number;
  } | null>(null);
  
  // Add state for Clarifai results
  const [clarifaiResults, setClarifaiResults] = useState<FoodRecognitionResult[]>([]);
  
  // Remove TensorFlow provider import
  // const { isLoaded: tensorflowReady } = useTensorFlow();

  // Safe version of setLoadingMessage
  const safeSetLoadingMessage = (message: string) => {
    setLoadingMessage(typeof message === 'string' ? message : String(message));
  };

  useEffect(() => {
    (async () => {
      const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
      const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setHasPermission(cameraStatus === "granted");
      loadSubscription();
      startPulseAnimation();
    })();
  }, []);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const loadSubscription = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      const userSub = await subscriptionService.getUserSubscription(userId);
      setSubscription(userSub);

      // Handle different subscription data structures with type assertions
      const remainingScans = 
        (userSub as any)?.scansRemaining || 
        (userSub as any)?.features?.scansRemaining ||
        (userSub as any)?.features?.dailyRecognitions || 
        10;
        
      setScansLeft(remainingScans);
    } catch (error) {
      console.error("Error loading subscription:", error);
    }
  };

  const takePicture = async () => {
    if (!camera) return;

    try {
      const photo = await camera.takePictureAsync({ quality: 0.7 });
      const resizedPhoto = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      setImage(resizedPhoto.uri);
    } catch (error) {
      console.error("Camera error:", error);
      Alert.alert("Error", "Failed to take picture");
    }
  };
  
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        const optimizedImage = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 800 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );
        setImage(optimizedImage.uri);
      }
    } catch (error) {
      console.error("Image picker error:", error);
      Alert.alert("Error", "Failed to pick an image");
    }
  };

  const identifyFood = async () => {
    if (!image) {
      Alert.alert("Error", "Please take or select an image first");
      return;
    }

    if (scansLeft <= 0 && subscription?.plan === "free") {
      Alert.alert(
        "Scan Limit Reached",
        "Upgrade to premium for unlimited food scanning"
      );
      return;
    }

    setLoading(true);
    
    // First validate the image before sending to API
    const imageValidation = await validateImage(image);
    if (!imageValidation.valid) {
      setLoading(false);
      Alert.alert(
        "Invalid Image",
        `${imageValidation.reason || "Please try a different image"}`
      );
      return;
    }
    
    safeSetLoadingMessage("Analyzing your food...");
    
    let recognitionSuccess = false;
    let recognizedFood: string | null = null;

    try {
      // First try with Clarifai service
      safeSetLoadingMessage("Analyzing with Clarifai API...");
      const foodResult = await recognizeFood(image);
      
      // If Clarifai fails, try with TensorFlow
      if (!foodResult.success) {
        safeSetLoadingMessage("Trying alternative recognition method...");
        
        try {
          // Fallback to TensorFlow recognition
          const tensorflowResult = await TensorFlowFoodRecognitionService.recognizeFood(image);
          
          if (tensorflowResult.success) {
            recognitionSuccess = true;
            recognizedFood = tensorflowResult.name;
            
            // Convert TensorFlow result to our standard format
            const resultData = {
              name: tensorflowResult.name,
              description: tensorflowResult.description || `This appears to be ${tensorflowResult.name}`,
              ingredients: tensorflowResult.ingredients || ["Ingredients information not available"],
              culturalInfo: tensorflowResult.culturalInfo || "Cultural information not available",
              confidence: tensorflowResult.confidence,
            };
            
            setDetectedFood(resultData);
            
            // Ensure we're creating an object that matches the expected type structure
            const resultObject = {
              name: tensorflowResult.name,
              food: tensorflowResult.name,
              confidence: tensorflowResult.confidence,
              otherOptions: tensorflowResult.otherOptions || [],
              foodType: "International" // Default value if not provided by TensorFlow
            };
            
            setResult(resultObject);
            
            // Continue with the rest of the function
          } else {
            // If both methods fail, show error
            setLoading(false);
            Alert.alert(
              "Recognition Failed",
              "We couldn't identify food in this image. Please try a clearer photo of food."
            );
            return;
          }
        } catch (fallbackError) {
          // If fallback also fails, show the original error
          console.error("Fallback recognition error:", fallbackError);
          setLoading(false);
          Alert.alert(
            "Recognition Failed",
            foodResult.errorMessage || "Unable to recognize food. Please try a different image."
          );
          return;
        }
      } else {
        // Continue with Clarifai successful result
        recognitionSuccess = true;
        recognizedFood = foodResult.dishName;
        
        // Set the Clarifai results for alternative display
        if (foodResult.alternatives) {
          setClarifaiResults(
            [{ name: foodResult.dishName, probability: foodResult.confidence }, 
             ...foodResult.alternatives.map(alt => ({ name: alt.name, probability: alt.confidence }))]
          );
        }
        
        // Format the result for display
        const resultData = {
          name: foodResult.dishName,
          description: `This appears to be ${foodResult.dishName}, a ${foodResult.foodType} dish, identified with ${Math.round(foodResult.confidence * 100)}% confidence.`,
          ingredients: foodResult.ingredients || ["Ingredients information not available"],
          culturalInfo: `This is a popular ${foodResult.foodType} dish enjoyed around the world.`,
          confidence: foodResult.confidence,
        };
        
        setDetectedFood(resultData);
        setResult({
          food: foodResult.dishName,
          confidence: foodResult.confidence,
          otherOptions: foodResult.alternatives,
          nutritionData: foodResult.nutritionData,
          foodType: foodResult.foodType
        });
      }
      
      // Only track successful recognitions
      if (recognitionSuccess) {
        // If successful, decrement the scan count for free users
        if (subscription?.plan === "free" && auth.currentUser) {
          try {
            // Update scans left count in UI
            setScansLeft(prev => Math.max(0, prev - 1));
            
            // Update the subscription in Firestore using the correct approach
            if (auth.currentUser?.uid) {
              const userRef = doc(db, "users", auth.currentUser.uid);
              await updateDoc(userRef, {
                "subscription.triesRemaining": Math.max(0, (subscription.triesRemaining || 0) - 1)
              });
            }
          } catch (updateError) {
            console.error("Error updating scan count:", updateError);
          }
        }
        
        // Save the recognized food to Firestore if user is logged in
        if (auth.currentUser && recognizedFood) {
          try {
            // Save to Firestore directly
            await addDoc(collection(db, "scannedFoods"), {
              userId: auth.currentUser.uid,
              foodData: {
                name: recognizedFood,
                description: detectedFood?.description || "",
                ingredients: detectedFood?.ingredients || [],
                culturalInfo: detectedFood?.culturalInfo || ""
              },
              imageUrl: image,
              timestamp: serverTimestamp(),
              confidence: result?.confidence || 0
            });
          } catch (saveError) {
            console.error("Error saving recognized food:", saveError);
          }
        }
        
        // Track the food recognition event
        console.log("Tracking food recognition event:", { success: recognitionSuccess, food: recognizedFood });
        await analyticsService.trackEvent("food_recognition", {
          success: recognitionSuccess,
          detected_food: recognizedFood
        });
      }
    } catch (error) {
      console.error("Food recognition error:", error);
      Alert.alert(
        "Recognition Error",
        "An error occurred while trying to recognize the food. Please try again."
      );
    } finally {
      setLoading(false);
      setShowResults(!!recognizedFood); // Show results modal only if food was recognized
    }
  };

  const handleRetake = () => {
    setImage(null);
    setResult(null);
    setLoading(false);
    safeSetLoadingMessage("Analyzing your food...");
  };

  const handleSave = async () => {
    if (!result || !image) return;

    try {
      setLoading(true);
      safeSetLoadingMessage("Saving to your collection...");
      
      await addDoc(collection(db, "scannedFoods"), {
        userId: auth.currentUser?.uid,
        imageUrl: image,
        foodData: result,
        timestamp: serverTimestamp(),
      });
      
      Alert.alert(
        "Saved Successfully",
        "Food has been saved to your collection!",
        [
          { text: "View Collection", onPress: () => navigation.navigate("ProfileTab") },
          { text: "Scan Another", onPress: handleRetake },
        ]
      );
    } catch (error) {
      console.error("Save error:", error);
      Alert.alert("Error", "Failed to save food");
    } finally {
      setLoading(false);
    }
  };

  const renderLoadingUI = () => (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
      <SafeText style={styles.loadingText}>{loadingMessage}</SafeText>
      </View>
    );

  const renderResultModal = () => {
    if (!detectedFood) return null;
    
    return (
      <Modal visible={showResults} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.resultModal}>
            <ScrollView>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowResults(false)}
              >
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
              
              <SafeText style={styles.modalResultTitle}>Recognition Result</SafeText>
              
              <View style={styles.foodInfoContainer}>
                <SafeText style={styles.foodName}>{detectedFood.name}</SafeText>
                
                <View style={styles.confidenceContainer}>
                  <SafeText style={styles.confidenceLabel}>Confidence:</SafeText>
                  <View style={styles.confidenceBar}>
                    <View
                      style={[
                        styles.confidenceFill,
                        { width: `${Math.min(100, detectedFood.confidence * 100)}%` },
                      ]}
                    />
                  </View>
                  <SafeText style={styles.confidenceValue}>
                    {`${(detectedFood.confidence * 100).toFixed(1)}%`}
                  </SafeText>
                </View>
                
                {/* Alternative Foods Section */}
                {result?.otherOptions && result.otherOptions.length > 0 && (
                  <>
                    <SafeText style={styles.sectionTitle}>Alternative Matches</SafeText>
                    <View style={styles.alternativesContainer}>
                      {result.otherOptions.map((option, index) => (
                        <View key={index} style={styles.alternativeItem}>
                          <SafeText style={styles.alternativeName}>{option.name}</SafeText>
                          <View style={styles.altConfidenceBar}>
                            <View
                              style={[
                                styles.altConfidenceFill,
                                { width: `${Math.min(100, option.confidence * 100)}%` },
                              ]}
                            />
                          </View>
                          <SafeText style={styles.altConfidenceValue}>
                            {`${(option.confidence * 100).toFixed(1)}%`}
                          </SafeText>
                        </View>
                      ))}
                    </View>
                  </>
                )}
                
                <SafeText style={styles.sectionTitle}>Description</SafeText>
                <SafeText style={styles.description}>{detectedFood.description}</SafeText>
                
                <SafeText style={styles.sectionTitle}>Ingredients</SafeText>
                <View style={styles.ingredientsContainer}>
                  {detectedFood.ingredients.length > 0 ? (
                    detectedFood.ingredients.map((ingredient, index) => (
                      <View key={index} style={styles.ingredientTag}>
                        <SafeText style={styles.ingredientTagText}>
                          {ingredient}
                        </SafeText>
                      </View>
                    ))
                  ) : (
                    <SafeText style={styles.description}>No ingredients listed</SafeText>
                  )}
                </View>
                
                <SafeText style={styles.sectionTitle}>Cultural Background</SafeText>
                <SafeText style={styles.description}>{detectedFood.culturalInfo}</SafeText>
              </View>
            </ScrollView>
            
            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={styles.saveButton} 
                onPress={handleSave}
              >
                <Ionicons name="save-outline" size={18} color="#fff" />
                <SafeText style={styles.buttonText}>Save to Collection</SafeText>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.retakeButton} 
                onPress={handleRetake}
              >
                <Ionicons name="camera-outline" size={18} color="#fff" />
                <SafeText style={styles.buttonText}>Take New Photo</SafeText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderContent = () => {
    if (hasPermission === null) {
      return <View style={styles.container} />;
    }
    
    if (hasPermission === false) {
      return (
        <View style={styles.permissionDeniedContainer}>
          <LinearGradient colors={["#FF6B35", "#FF8E53"]} style={styles.header}>
            <SafeText style={styles.title}>📸 Food Recognition</SafeText>
            <SafeText style={styles.subtitle}>
              Identify dishes and learn about their cultural background
            </SafeText>
          </LinearGradient>
          
          <View style={styles.content}>
            <SafeText style={styles.permissionDeniedText}>
              Camera permission is required to use this feature
            </SafeText>
            <TouchableOpacity 
              style={styles.permissionButton}
              onPress={() => Linking.openSettings()}
            >
              <SafeText style={styles.permissionButtonText}>Open Settings</SafeText>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#FF6B35" />
        
        <LinearGradient colors={["#FF6B35", "#FF8E53"]} style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <SafeText style={styles.title}>📸 Food Recognition</SafeText>
          <SafeText style={styles.subtitle}>
            Identify dishes and learn about their cultural background
          </SafeText>
        </LinearGradient>

        <ScrollView style={styles.content}>
          {subscription?.plan === "free" && (
            <View style={styles.usageContainer}>
              <View style={styles.usageHeader}>
                <Ionicons name="restaurant" size={24} color="#FF6B35" />
                <SafeText style={styles.usageText}>
                  🍱 {scansLeft}/10 Scans Left Today
                </SafeText>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${(scansLeft / 10) * 100}%`,
                      backgroundColor: scansLeft > 6 ? "#4CAF50" : scansLeft > 3 ? "#FFC107" : "#F44336",
                    },
                  ]}
                />
              </View>
            </View>
          )}

          <View style={styles.infoCard}>
            <View style={styles.infoHeader}>
              <Ionicons name="information-circle" size={24} color="#FF6B35" />
              <SafeText style={styles.infoTitle}>Food Recognition Service</SafeText>
            </View>
            <SafeText style={styles.infoText}>
              This app uses advanced AI to identify food dishes from photos and provides cultural background information.
              For best results, take clear photos of the dish with good lighting.
            </SafeText>
            <View style={styles.tipContainer}>
              <SafeText style={styles.tipTitle}>📝 Tips for better results:</SafeText>
              <SafeText style={styles.tipText}>• Take clear, well-lit photos</SafeText>
              <SafeText style={styles.tipText}>• Center the dish in the frame</SafeText>
              <SafeText style={styles.tipText}>• Avoid glare and shadows</SafeText>
              <SafeText style={styles.tipText}>• Try to capture the whole dish</SafeText>
            </View>
          </View>

          {!image ? (
            <View style={styles.cameraContainer}>
              <Camera
                style={styles.camera}
                ref={(ref) => setCamera(ref)}
                type={CameraType.back}
                ratio="16:9"
              >
                <View style={styles.cameraOverlay}>
                  <View style={styles.cameraFrame}>
                    <View style={styles.cornerTL} />
                    <View style={styles.cornerTR} />
                    <View style={styles.cornerBL} />
                    <View style={styles.cornerBR} />
                  </View>
                  <SafeText style={styles.cameraHint}>Position food in frame</SafeText>
                  
                  <TouchableOpacity
                    style={styles.captureButton}
                    onPress={takePicture}
                  >
                    <View style={styles.captureButtonInner} />
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.libraryButton}
                    onPress={pickImage}
                  >
                    <View style={styles.libraryButtonInner}>
                      <Ionicons name="images-outline" size={26} color="#fff" />
                    </View>
                    <SafeText style={styles.buttonLabel}>Gallery</SafeText>
                  </TouchableOpacity>
                </View>
              </Camera>
            </View>
          ) : (
            <View style={styles.previewContainer}>
              <Image source={{ uri: image }} style={styles.previewImage} />
              
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#FF6B35" />
                  <SafeText style={styles.loadingText}>{loadingMessage}</SafeText>
                </View>
              ) : result ? (
                <View style={styles.resultOverlay}>
                  <LinearGradient
                    colors={["transparent", "rgba(0,0,0,0.8)"]}
                    style={styles.resultGradient}
                  >
                    <SafeText style={styles.resultName}>{result.name}</SafeText>
                    <TouchableOpacity
                      style={styles.viewDetailsButton}
                      onPress={() => setShowResults(true)}
                    >
                      <SafeText style={styles.viewDetailsText}>View Details</SafeText>
                      <Ionicons name="chevron-forward" size={16} color="#fff" />
                    </TouchableOpacity>
                  </LinearGradient>
                </View>
              ) : (
                <View style={styles.scanButtons}>
                  <TouchableOpacity
                    style={styles.identifyButton}
                    onPress={identifyFood}
                  >
                    <Ionicons name="scan-outline" size={24} color="#fff" />
                    <SafeText style={styles.identifyButtonText}>Identify Food</SafeText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.retakePhotoButton}
                    onPress={handleRetake}
                  >
                    <Ionicons name="refresh-outline" size={20} color="#FF6B35" />
                    <SafeText style={styles.retakePhotoText}>Retake Photo</SafeText>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {subscription?.plan === "free" && (
            <View style={styles.premiumFeatures}>
              <SafeText style={styles.premiumTitle}>Premium Features</SafeText>
              <View style={styles.featureCards}>
                <View style={styles.featureCard}>
                  <Ionicons name="infinite" size={24} color="#FF6B35" />
                  <SafeText style={styles.featureCardText}>
                    Unlimited Scans
                  </SafeText>
                </View>
                <View style={styles.featureCard}>
                  <Ionicons name="book" size={24} color="#FF6B35" />
                  <SafeText style={styles.featureCardText}>
                    Complete Cultural Info
                  </SafeText>
                </View>
                <View style={styles.featureCard}>
                  <Ionicons name="nutrition" size={24} color="#FF6B35" />
                  <SafeText style={styles.featureCardText}>
                    Nutritional Facts
                  </SafeText>
                </View>
                <View style={styles.featureCard}>
                  <Ionicons name="folder" size={24} color="#FF6B35" />
                  <SafeText style={styles.featureCardText}>
                    Unlimited Storage
                  </SafeText>
                </View>
              </View>
              <Animated.View
                style={[
                  styles.upgradeButton,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              >
                <TouchableOpacity>
                  <SafeText style={styles.upgradeButtonText}>
                    ✨ UPGRADE NOW - 50% OFF
                  </SafeText>
                </TouchableOpacity>
              </Animated.View>
            </View>
          )}
        </ScrollView>

        {renderResultModal()}
      </View>
    );
  };

  return (
    <TensorFlowLoader>
      {renderContent()}
    </TensorFlowLoader>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    padding: 20,
    paddingTop: Platform.OS === "ios" ? 50 : 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    marginBottom: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  usageContainer: {
    backgroundColor: "#f8f8f8",
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  usageHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  usageText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginLeft: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: "#eee",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  infoCard: {
    backgroundColor: "#f8f8f8",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FF6B35",
    marginLeft: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 20,
  },
  tipContainer: {
    marginTop: 10,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  tipText: {
    fontSize: 14,
    color: "#555",
    marginBottom: 5,
  },
  previewContainer: {
    height: width * 0.9,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  resultOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  resultGradient: {
    padding: 24,
    paddingBottom: 30,
  },
  resultName: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 12,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  viewDetailsButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewDetailsText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginRight: 8,
  },
  scanButtons: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  identifyButton: {
    backgroundColor: "#FF6B35",
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 30,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#FF6B35",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  identifyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 10,
  },
  retakePhotoButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  retakePhotoText: {
    color: "#FF6B35",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 6,
  },
  cameraContainer: {
    height: width * 0.9,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 20,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  cameraFrame: {
    width: width * 0.7,
    aspectRatio: 1,
    borderRadius: 20,
    position: "relative",
  },
  cornerTL: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: "#fff",
    borderTopLeftRadius: 20,
  },
  cornerTR: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: "#fff",
    borderTopRightRadius: 20,
  },
  cornerBL: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: "#fff",
    borderBottomLeftRadius: 20,
  },
  cornerBR: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: "#fff",
    borderBottomRightRadius: 20,
  },
  cameraHint: {
    color: "#fff",
    fontSize: 16,
    marginTop: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    overflow: "hidden",
  },
  captureButton: {
    position: "absolute",
    bottom: 15,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  captureButtonInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
  },
  libraryButton: {
    position: "absolute",
    bottom: 20,
    left: 30,
    alignItems: "center",
  },
  libraryButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonLabel: {
    color: "#fff",
    fontSize: 14,
    marginTop: 8,
    fontWeight: "500",
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 20,
    color: "#333",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  resultModal: {
    backgroundColor: "#fff",
    borderRadius: 24,
    width: "90%",
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    overflow: "hidden",
  },
  closeButton: {
    position: "absolute",
    top: 15,
    right: 15,
    zIndex: 1,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  modalResultTitle: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 24,
    marginBottom: 20,
    color: "#FF6B35",
  },
  foodInfoContainer: {
    padding: 24,
  },
  foodName: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#333",
  },
  confidenceContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    backgroundColor: "#f8f9fa",
    padding: 12,
    borderRadius: 12,
  },
  confidenceLabel: {
    fontWeight: "bold",
    marginRight: 10,
    color: "#555",
  },
  confidenceBar: {
    flex: 1,
    height: 10,
    backgroundColor: "#e9ecef",
    borderRadius: 5,
    overflow: "hidden",
  },
  confidenceFill: {
    height: "100%",
    backgroundColor: "#FF6B35",
  },
  confidenceValue: {
    marginLeft: 10,
    fontWeight: "bold",
    color: "#FF6B35",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 12,
    color: "#FF6B35",
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
    color: "#444",
  },
  ingredientsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  ingredientTag: {
    backgroundColor: "#f0f5ff",
    padding: 10,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e0e7ff",
  },
  ingredientTagText: {
    fontSize: 14,
    color: "#4062bb",
  },
  actionButtons: {
    flexDirection: "row",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#4CAF50",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    shadowColor: "#4CAF50",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  retakeButton: {
    flex: 1,
    backgroundColor: "#FF6B35",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FF6B35",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    marginLeft: 8,
    fontSize: 15,
  },
  permissionDeniedContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  permissionDeniedText: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 26,
    color: "#555",
  },
  permissionButton: {
    backgroundColor: "#FF6B35",
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 30,
    shadowColor: "#FF6B35",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    alignSelf: "center",
  },
  permissionButtonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  premiumFeatures: {
    marginTop: 20,
    marginBottom: 20,
  },
  premiumTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
  },
  featureCards: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  featureCard: {
    width: "48%",
    backgroundColor: "#f8f8f8",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    alignItems: "center",
  },
  featureCardText: {
    fontSize: 14,
    color: "#333",
    marginTop: 8,
    textAlign: "center",
  },
  upgradeButton: {
    backgroundColor: "#FF6B35",
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: "center",
  },
  upgradeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  alternativesContainer: {
    marginBottom: 20,
  },
  alternativeItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  alternativeName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginRight: 10,
  },
  altConfidenceBar: {
    flex: 1,
    height: 10,
    backgroundColor: "#e9ecef",
    borderRadius: 5,
    overflow: "hidden",
  },
  altConfidenceFill: {
    height: "100%",
    backgroundColor: "#FF6B35",
  },
  altConfidenceValue: {
    marginLeft: 10,
    fontWeight: "bold",
    color: "#FF6B35",
  },
});

export default FoodRecognitionScreen;