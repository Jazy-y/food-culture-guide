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
  Animated,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Camera, CameraType } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { TabScreenProps } from "../types/navigation";
import { auth, db } from "../config/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc,
} from "firebase/firestore";
import { subscriptionService } from "../services/subscription-service";
import { LinearGradient } from "expo-linear-gradient";
import * as ImageManipulator from "expo-image-manipulator";
import TranslationService from "../services/translation-service";
import * as ImagePicker from "expo-image-picker";

type Props = TabScreenProps<"TranslationTab">;

const { width } = Dimensions.get("window");

const TranslationScreen: React.FC<Props> = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [camera, setCamera] = useState<Camera | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [translation, setTranslation] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [subscription, setSubscription] = useState<any>(null);
  const [translationsLeft, setTranslationsLeft] = useState(3);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [loadingStatus, setLoadingStatus] = useState<string>("");
  const [ocrEngine, setOcrEngine] = useState<string>("Loading...");
  const [originalText, setOriginalText] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
      const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      setHasPermission(cameraStatus === "granted");
      loadSubscription();
      startPulseAnimation();
      
      // Set OCR engine name
      setOcrEngine("OCR.space API (with Google Vision fallback)");
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
      setTranslationsLeft(userSub?.triesRemaining || 3);
    } catch (error) {
      console.error("Error loading subscription:", error);
    }
  };

  const takePicture = async () => {
    if (!camera) return;

    try {
      const photo = await camera.takePictureAsync();
      const resizedPhoto = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      setImage(resizedPhoto.uri);
    } catch (error) {
      Alert.alert("Error", "Failed to take picture");
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];
        
        // Optimize the image for OCR
        const optimizedImage = await ImageManipulator.manipulateAsync(
          selectedAsset.uri,
          [{ resize: { width: 1000 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );
        
        setImage(optimizedImage.uri);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick an image");
    }
  };

  const handleTranslate = async () => {
    if (!image) {
      Alert.alert("Error", "Please take a picture first");
      return;
    }

    if (translationsLeft <= 0 && subscription?.plan === "free") {
      Alert.alert(
        "Translation Limit Reached",
        "Upgrade to premium for unlimited translations"
      );
      return;
    }

    setLoading(true);
    setTranslation(""); // Clear previous translation
    setLoadingStatus("Initializing translation process...");
    
    try {
      const result = await TranslationService.translateScreenshot(
        image, 
        targetLanguage,
        (status) => {
          // Update status message in real-time
          setLoadingStatus(status);
        }
      );
      
      if (!result.original || result.original.trim() === "") {
        Alert.alert(
          "No Text Detected", 
          "We couldn't detect any text in this image. Try taking a clearer photo with good lighting and make sure text is visible."
        );
        setLoading(false);
        return;
      }
      
      setTranslation(result.translated);
      setOriginalText(result.original);

      if (subscription?.plan === "free") {
        setTranslationsLeft((prev) => prev - 1);
        const userId = auth.currentUser?.uid;
        if (userId) {
          await updateDoc(doc(db, "users", userId), {
            "subscription.triesRemaining": translationsLeft - 1,
          });
        }
      }
    } catch (error: any) {
      console.error("Translation error:", error);
      
      // Provide more specific error messages based on the error
      let errorMessage = "There was an error processing your request. Please try again.";
      
      if (error.message?.includes("timed out")) {
        errorMessage = "The translation request timed out. Please check your network connection and try again.";
      } else if (error.message?.includes("No text detected")) {
        errorMessage = "No text could be detected in this image. Try taking a clearer photo with good lighting.";
      } else if (error.message?.includes("OCR processing error")) {
        errorMessage = "There was an error processing the text in your image. Try a clearer image or a different angle.";
      } else if (error.message?.includes("translation services failed")) {
        errorMessage = "Our translation services are currently unavailable. Please try again later.";
      } else if (error.message?.includes("rate limit")) {
        errorMessage = "We've hit the rate limit for our translation services. Please try again in a few minutes.";
      }
      
      Alert.alert(
        "Translation Failed", 
        errorMessage
      );
    } finally {
      setLoadingStatus("");
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!translation || !image) {
      console.log("Cannot save: missing translation or image");
      Alert.alert("Error", "Missing translation or image");
      return;
    }

    try {
      console.log("Starting save to Firestore with userId:", auth.currentUser?.uid);
      
      if (!auth.currentUser) {
        console.error("No authenticated user found");
        Alert.alert("Error", "You must be logged in to save translations");
        return;
      }
      
      // Create the document data with all required fields
      const translationData = {
        userId: auth.currentUser.uid,
        imageUrl: image,
        originalText: originalText || "",
        translation,
        targetLanguage,
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString() // Fallback timestamp in case serverTimestamp fails
      };
      
      console.log("Saving translation data:", JSON.stringify({
        ...translationData,
        timestamp: "SERVER_TIMESTAMP" // Just for logging
      }));
      
      // Add the document to Firestore
      const docRef = await addDoc(collection(db, "translations"), translationData);
      
      console.log("Translation saved successfully with ID:", docRef.id);
      Alert.alert("Success", "Translation saved to your account!");
      
      // Update translations left count if needed
      if (subscription?.plan !== "premium") {
        setTranslationsLeft(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Error saving translation:", error);
      Alert.alert("Error", "Failed to save translation. Please try again.");
    }
  };

  const getProgressColor = () => {
    const percentage = (translationsLeft / 3) * 100;
    if (percentage > 66) return "#4CAF50";
    if (percentage > 33) return "#FFC107";
    return "#F44336";
  };

  const resetTranslation = () => {
    // If translation is in progress, confirm before canceling
    if (loading) {
      Alert.alert(
        "Cancel Translation?",
        "The current translation is still in progress. Are you sure you want to cancel and start over?",
        [
          { text: "No", style: "cancel" },
          { 
            text: "Yes", 
            onPress: () => {
              setImage(null);
              setTranslation("");
              setLoadingStatus("");
              setLoading(false);
            } 
          }
        ]
      );
      return;
    }
    
    // If there's a translation already, confirm before clearing
    if (translation) {
      Alert.alert(
        "Clear Translation?",
        "This will clear the current translation and allow you to take a new photo. Continue?",
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Clear", 
            style: "destructive",
            onPress: () => {
              setImage(null);
              setTranslation("");
            } 
          }
        ]
      );
      return;
    }
    
    // If no translation yet, just clear the image
    setImage(null);
  };

  if (hasPermission === null) {
    return <View style={styles.container} />;
  }
  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={["#FF6B35", "#FF8E53"]} style={styles.header}>
          <Text style={styles.title}>📸 Snap & Translate Menus</Text>
          <Text style={styles.subtitle}>
            Get instant dish translations in 12 languages
          </Text>
        </LinearGradient>
        
        <View style={styles.content}>
          <Text style={styles.noCameraText}>No access to camera</Text>
          <TouchableOpacity 
            style={styles.alternateUploadButton}
            onPress={pickImage}
          >
            <Ionicons name="cloud-upload" size={24} color="#fff" style={styles.uploadIcon} />
            <Text style={styles.uploadButtonText}>Upload Image</Text>
          </TouchableOpacity>
          
          {image && (
            <View style={styles.imageContainer}>
              <Image source={{ uri: image }} style={styles.image} />
              <TouchableOpacity
                style={styles.retakeButton}
                onPress={resetTranslation}
              >
                <Ionicons name="refresh" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
          
          {/* Show translation UI if an image is uploaded */}
          {image && (
            <>
              <View style={styles.languagePicker}>
                <Text style={styles.languageLabel}>Translate to:</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={targetLanguage}
                    onValueChange={(value) => setTargetLanguage(value)}
                    style={styles.picker}
                  >
                    <Picker.Item label="English" value="en" />
                    <Picker.Item label="Spanish" value="es" />
                    <Picker.Item label="French" value="fr" />
                    <Picker.Item label="German" value="de" />
                    <Picker.Item label="Italian" value="it" />
                    <Picker.Item label="Portuguese" value="pt" />
                    <Picker.Item label="Russian" value="ru" />
                    <Picker.Item label="Japanese" value="ja" />
                    <Picker.Item label="Chinese (Simplified)" value="zh" />
                    <Picker.Item label="Korean" value="ko" />
                    <Picker.Item label="Arabic" value="ar" />
                    <Picker.Item label="Hindi" value="hi" />
                  </Picker>
                </View>
              </View>

              {translation ? (
                <View style={styles.translationContainer}>
                  <Text style={styles.translationText}>{translation}</Text>
                  <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                    <Text style={styles.saveButtonText}>Save Translation</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.translateButton, loading && styles.translateButtonDisabled]}
                  onPress={handleTranslate}
                  disabled={loading || !image}
                >
                  {loading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={styles.loadingText}>
                        {loadingStatus || "Processing..."}
                      </Text>
                      <Text style={styles.loadingSubtext}>
                        OCR extraction can take 15-20 seconds
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.translateButtonText}>Translate</Text>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#FF6B35", "#FF8E53"]} style={styles.header}>
        <Text style={styles.title}>📸 Snap & Translate Menus</Text>
        <Text style={styles.subtitle}>
          Get instant dish translations in 12 languages
        </Text>
      </LinearGradient>

      <ScrollView style={styles.content}>
        <View style={styles.usageContainer}>
          <View style={styles.usageHeader}>
            <Ionicons name="restaurant" size={24} color="#FF6B35" />
            <Text style={styles.usageText}>
              🍱 {translationsLeft}/3 Translations Left Today
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${((translationsLeft) / 3) * 100}%`,
                  backgroundColor: getProgressColor(),
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="information-circle" size={24} color="#FF6B35" />
            <Text style={styles.infoTitle}>Translation Services</Text>
          </View>
          <Text style={styles.infoText}>
            This app uses OCR to extract text from images and free translation APIs to translate it.
            For best results, the app can use Tesseract.js for on-device OCR or OCR.space API as fallback.
          </Text>
          <View style={styles.ocrEngineContainer}>
            <Text style={styles.ocrEngineLabel}>OCR Engine: </Text>
            <View style={[
              styles.ocrEngineBadge, 
              {backgroundColor: ocrEngine.includes("Tesseract") ? "#4CAF50" : "#FF6B35"}
            ]}>
              <Text style={styles.ocrEngineName}>{ocrEngine}</Text>
            </View>
          </View>
          <View style={styles.tipContainer}>
            <Text style={styles.tipTitle}>📝 Tips for better results:</Text>
            <Text style={styles.tipText}>• Take clear, well-lit photos of text</Text>
            <Text style={styles.tipText}>• Avoid glare and shadows on the menu</Text>
            <Text style={styles.tipText}>• Select the language that matches the menu language</Text>
            <Text style={styles.tipText}>• Hold the camera steady when taking photos</Text>
          </View>
        </View>

        <View style={styles.subscriptionCard}>
          <View style={styles.planHeader}>
            <Ionicons name="flash" size={24} color="#FF6B35" />
            <Text style={styles.planTitle}>CURRENT PLAN</Text>
          </View>
          <Text style={styles.planName}>BASIC (Limited)</Text>
          <View style={styles.divider} />
          <View style={styles.planFeatures}>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#FF6B35" />
              <Text style={styles.featureText}>3 translations/day</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#FF6B35" />
              <Text style={styles.featureText}>Basic dish info</Text>
            </View>
          </View>
        </View>

        {!image ? (
          <View style={styles.cameraContainer}>
            <Camera
              style={styles.camera}
              ref={(ref) => setCamera(ref)}
              type={CameraType.back}
            >
              <View style={styles.cameraOverlay}>
                <View style={styles.cameraFrame} />
                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={takePicture}
                >
                  <View style={styles.captureButtonInner} />
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={pickImage}
                >
                  <Ionicons name="images" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </Camera>
          </View>
        ) : (
          <View style={styles.imageContainer}>
            <Image source={{ uri: image }} style={styles.image} />
            <TouchableOpacity
              style={styles.retakeButton}
              onPress={resetTranslation}
            >
              <Ionicons name="refresh" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.languagePicker}>
          <Text style={styles.languageLabel}>Translate to:</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={targetLanguage}
              onValueChange={(value) => setTargetLanguage(value)}
              style={styles.picker}
            >
              <Picker.Item label="English" value="en" />
              <Picker.Item label="Spanish" value="es" />
              <Picker.Item label="French" value="fr" />
              <Picker.Item label="German" value="de" />
              <Picker.Item label="Italian" value="it" />
              <Picker.Item label="Portuguese" value="pt" />
              <Picker.Item label="Russian" value="ru" />
              <Picker.Item label="Japanese" value="ja" />
              <Picker.Item label="Chinese (Simplified)" value="zh" />
              <Picker.Item label="Korean" value="ko" />
              <Picker.Item label="Arabic" value="ar" />
              <Picker.Item label="Hindi" value="hi" />
            </Picker>
          </View>
        </View>

        {translation ? (
          <View style={styles.translationContainer}>
            <Text style={styles.translationText}>{translation}</Text>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Save Translation</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.translateButton, loading && styles.translateButtonDisabled]}
            onPress={handleTranslate}
            disabled={loading || !image}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.loadingText}>
                  {loadingStatus || "Processing..."}
                </Text>
                <Text style={styles.loadingSubtext}>
                  OCR extraction can take 15-20 seconds
                </Text>
              </View>
            ) : (
              <Text style={styles.translateButtonText}>Translate</Text>
            )}
          </TouchableOpacity>
        )}

        {subscription?.plan === "free" && (
          <View style={styles.premiumFeatures}>
            <Text style={styles.premiumTitle}>Premium Features</Text>
            <View style={styles.featureCards}>
              <View style={styles.featureCard}>
                <Ionicons name="key" size={24} color="#FF6B35" />
                <Text style={styles.featureCardText}>
                  Unlimited Translations
                </Text>
              </View>
              <View style={styles.featureCard}>
                <Ionicons name="folder" size={24} color="#FF6B35" />
                <Text style={styles.featureCardText}>Offline Access</Text>
              </View>
              <View style={styles.featureCard}>
                <Ionicons name="mic" size={24} color="#FF6B35" />
                <Text style={styles.featureCardText}>Voice Commands</Text>
              </View>
              <View style={styles.featureCard}>
                <Ionicons name="globe" size={24} color="#FF6B35" />
                <Text style={styles.featureCardText}>Cultural Insights</Text>
              </View>
              <View style={styles.featureCard}>
                <Ionicons name="infinite" size={24} color="#FF6B35" />
                <Text style={styles.featureCardText}>
                  Unlimited Translations
                </Text>
              </View>
            </View>
            <Animated.View
              style={[
                styles.upgradeButton,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <TouchableOpacity>
                <Text style={styles.upgradeButtonText}>
                  ✨ UPGRADE NOW - 50% OFF FOR TRAVELERS
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}
      </ScrollView>
    </View>
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
  subscriptionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#FF6B35",
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  planTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#FF6B35",
    marginLeft: 8,
    letterSpacing: 1,
  },
  planName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: "#FF6B35",
    marginVertical: 15,
  },
  planFeatures: {
    marginBottom: 10,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  featureText: {
    fontSize: 16,
    color: "#333",
    marginLeft: 8,
  },
  cameraContainer: {
    height: width * 0.8,
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
    height: width * 0.7,
    borderWidth: 2,
    borderColor: "#fff",
    borderRadius: 20,
  },
  captureButton: {
    position: "absolute",
    bottom: 30,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
  },
  imageContainer: {
    height: width * 0.8,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 20,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  retakeButton: {
    position: "absolute",
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  languagePicker: {
    marginBottom: 20,
  },
  languageLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: "#f8f8f8",
    borderRadius: 12,
    overflow: "hidden",
  },
  picker: {
    height: 50,
  },
  translationContainer: {
    backgroundColor: "#f8f8f8",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  translationText: {
    fontSize: 16,
    color: "#333",
    marginBottom: 15,
  },
  translateButton: {
    backgroundColor: "#FF6B35",
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: "center",
    marginBottom: 20,
  },
  translateButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  saveButton: {
    backgroundColor: "#4CAF50",
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  premiumFeatures: {
    marginTop: 20,
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
  translateButtonDisabled: {
    backgroundColor: "#FF6B3580", // Same color with opacity
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 8,
  },
  loadingSubtext: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 8,
  },
  ocrEngineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  ocrEngineLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    marginRight: 8,
  },
  ocrEngineBadge: {
    padding: 5,
    borderRadius: 5,
  },
  ocrEngineName: {
    fontSize: 14,
    color: "#fff",
    fontWeight: "500",
  },
  uploadButton: {
    position: "absolute",
    bottom: 30,
    right: 30,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  noCameraText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 20,
  },
  alternateUploadButton: {
    backgroundColor: "#FF6B35",
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: "center",
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  uploadIcon: {
    marginRight: 8,
  },
  uploadButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default TranslationScreen;
