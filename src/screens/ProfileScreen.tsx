import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  TextInput,
  Alert,
} from "react-native";
import { TabScreenProps } from "../types/navigation";
import { Ionicons } from "@expo/vector-icons";
import {
  subscriptionService,
  UserSubscription as SubscriptionType,
} from "../services/subscription-service";
import { auth, storage, db } from "../config/firebase";
import * as ImagePicker from "expo-image-picker";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { updateProfile, sendPasswordResetEmail } from "firebase/auth";
import { mealDBService } from "../services/mealdb-service";
import { BottomSheet } from "../components/common";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  onSnapshot,
  getDoc,
  updateDoc,
  orderBy,
} from "firebase/firestore";
import StarRating from "react-native-star-rating-widget";
import { useAuth } from "../contexts/AuthContext";
import { getAvailableCurrencies } from "../utils/currencyUtils";
import { analyticsService } from "../services/analytics-service";
import { Picker } from "@react-native-picker/picker";
import { LinearGradient } from "expo-linear-gradient";

type Props = TabScreenProps<"ProfileTab">;

interface UserSubscription extends SubscriptionType {
  translationsUsed?: number;
}

interface UserData {
  email: string;
  isAdmin: boolean;
  displayName?: string;
  photoURL?: string;
}

const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { userData, updateUserData } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [showAccountSheet, setShowAccountSheet] = useState(false);
  const [accountAction, setAccountAction] = useState<
    "name" | "password" | "avatar" | "demographics"
  >("name");
  const [newName, setNewName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [userAge, setUserAge] = useState("");
  const [userGender, setUserGender] = useState("");
  const [userLocation, setUserLocation] = useState("");
  const [likedMeals, setLikedMeals] = useState<any[]>([]);
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [showFeedbackSheet, setShowFeedbackSheet] = useState(false);
  const [userReviews, setUserReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [activeAdminTab] = useState<string>("users");
  const [users, setUsers] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [savedFoods, setSavedFoods] = useState<any[]>([]);
  const [loadingSavedFoods, setLoadingSavedFoods] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [savedTranslations, setSavedTranslations] = useState<any[]>([]);
  const [showingTranslations, setShowingTranslations] = useState(false);
  const [loadingTranslations, setLoadingTranslations] = useState(false);
  const [showCurrencySelector, setShowCurrencySelector] = useState(false);
  const [currencies] = useState(getAvailableCurrencies());
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const userId = auth.currentUser?.uid;
        if (!userId) return;

        // Load all data in parallel
        const [userSub, user, reviews, userProfileDoc] = await Promise.all([
          subscriptionService.getUserSubscription(userId),
          auth.currentUser?.reload().then(() => auth.currentUser),
          loadUserReviews(userId),
          getDoc(doc(db, "users", userId))
        ]);

        setSubscription(userSub);
        setNewName(user?.displayName || "");
        setAvatarUrl(user?.photoURL || "");
        setUserReviews(reviews);

        // Load demographic data if available
        if (userProfileDoc.exists()) {
          const profileData = userProfileDoc.data();
          if (profileData.profile) {
            setUserAge(profileData.profile.age?.toString() || "");
            setUserGender(profileData.profile.gender || "");
            setUserLocation(profileData.profile.location || "");
          }
        }

        // Load saved food recognitions
        loadSavedFoods(userId);

        // Load liked meals from Firestore
        setLoadingLikes(true);
        const likedMealsRef = collection(db, "likedMeals");
        const q = query(likedMealsRef, where("userId", "==", userId));

        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
          const likedMealsData = await Promise.all(
            querySnapshot.docs.map(async (doc) => {
              const data = doc.data();
              try {
                // Fetch additional meal details from the API
                const mealDetails = await mealDBService.getMealDetails(
                  data.mealId
                );
                return {
                  id: doc.id,
                  mealId: data.mealId,
                  name: data.mealName,
                  imageUrl: data.mealThumb,
                  ...mealDetails,
                };
              } catch (error) {
                console.error("Error fetching meal details:", error);
                return null;
              }
            })
          );

          const validMeals = likedMealsData.filter(Boolean);
          setLikedMeals(validMeals);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error("Profile load error:", error);
      } finally {
        setLoading(false);
        setLoadingLikes(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (userData?.isAdmin) {
      loadAdminData();
    }
  }, [userData?.isAdmin]);

  useEffect(() => {
    // Check admin status
    auth.currentUser
      ?.getIdTokenResult()
      .then((token) => {
        setIsAdmin(!!token.claims.admin);
      })
      .catch((error) => {
        console.error("Error checking admin status:", error);
      });
  }, []);

  const loadUserReviews = async (userId: string) => {
    try {
      setLoadingReviews(true);
      
      // Try with ordering first
      try {
        const reviewsQuery = query(
          collection(db, "mealReviews"),
          where("userId", "==", userId),
          orderBy("timestamp", "desc")
        );
        const querySnapshot = await getDocs(reviewsQuery);
        const reviews = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate?.() || new Date()
        }));
        return reviews;
      } catch (indexError) {
        console.log("Index error on profile, falling back:", indexError);
        
        // Fallback to simple query without ordering
        const simpleQuery = query(
          collection(db, "mealReviews"),
          where("userId", "==", userId)
        );
        const querySnapshot = await getDocs(simpleQuery);
        const reviews = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate?.() || new Date()
        }))
        // Sort manually client-side
        .sort((a, b) => (b.timestamp instanceof Date && a.timestamp instanceof Date) 
          ? b.timestamp.getTime() - a.timestamp.getTime() 
          : 0);
        
        return reviews;
      }
    } catch (error) {
      console.error("Error loading reviews:", error);
      return [];
    } finally {
      setLoadingReviews(false);
    }
  };

  const loadAdminData = async () => {
    try {
      setLoading(true);
      // Load users
      const usersSnapshot = await getDocs(collection(db, "users"));
      const usersList = usersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsers(usersList);

      // Load feedback
      const feedbackSnapshot = await getDocs(collection(db, "feedback"));
      const feedbackList = feedbackSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setFeedback(feedbackList);
    } catch (error) {
      console.error("Error loading admin data:", error);
      Alert.alert("Error", "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  const handleAccountAction = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert("Error", "You must be logged in to perform this action");
        return;
      }

      if (accountAction === "name" && newName) {
        await updateProfile(user, { displayName: newName });
        updateUserData({ ...userData, displayName: newName });
        Alert.alert("Success", "Name updated successfully");
      } else if (accountAction === "password") {
        await sendPasswordResetEmail(auth, user.email || "");
        Alert.alert(
          "Password Reset",
          "Check your email for instructions to reset your password"
        );
      } else if (accountAction === "demographics") {
        if (!userAge) {
          Alert.alert("Error", "Please enter your age");
          return;
        }
        if (!userGender) {
          Alert.alert("Error", "Please select your gender");
          return;
        }
        
        const userRef = doc(db, "users", user.uid);
        
        // Fetch current user data to preserve existing fields
        const userDoc = await getDoc(userRef);
        const currentUserData = userDoc.exists() ? userDoc.data() : {};
        
        // Create or update the profile object, preserving any existing properties
        const newProfile = {
          ...(currentUserData.profile || {}),
          age: userAge ? parseInt(userAge) : null,
          gender: userGender && userGender.toLowerCase(), // Store gender in lowercase for consistency
          location: userLocation
        };
        
        // Update profile data with demographics
        await updateDoc(userRef, {
          profile: newProfile,
          updatedAt: new Date().toISOString()
        });
        
        // Log the updated profile data to verify
        console.log("Updated user profile:", newProfile);
        
        // Track profile update for analytics
        analyticsService.trackEvent("profile_update", {
          has_age: !!userAge,
          has_gender: !!userGender,
          has_location: !!userLocation
        });
        
        Alert.alert("Success", "Profile information updated successfully");
      } else if (accountAction === "avatar") {
        if (!previewImageUri) {
          return;
        }
        
        setUploading(true);
        setUploadProgress(0);
        
        if (!user) {
          throw new Error("User not authenticated");
        }

        // Create a unique file path in Firebase Storage
        const filePath = `avatars/${user.uid}/${new Date().getTime()}`;
        const storageRef = ref(storage, filePath);
        
        // Convert image to blob
        const response = await fetch(previewImageUri);
        const blob = await response.blob();
        
        // Create upload task to monitor progress
        const uploadTask = uploadBytes(storageRef, blob);
        
        // Monitor upload progress
        const interval = setInterval(() => {
          setUploadProgress((prev) => {
            const newProgress = prev + Math.random() * 20;
            return newProgress > 95 ? 95 : newProgress;
          });
        }, 500);
        
        // Wait for upload to complete
        await uploadTask;
        clearInterval(interval);
        setUploadProgress(100);
        
        // Get download URL
        const downloadUrl = await getDownloadURL(storageRef);
        
        // Update profile in Firebase Auth
        await updateProfile(user, { photoURL: downloadUrl });
        
        // Update profile in Firestore
        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, {
          photoURL: downloadUrl,
          updatedAt: new Date().toISOString(),
        });
        
        // Update local state
        setAvatarUrl(downloadUrl);
        
        // Track event in analytics
        analyticsService.trackEvent("update_profile_photo", {
          timestamp: new Date().toISOString(),
        });
        
        Alert.alert("Success", "Profile picture updated successfully");
        
        // Reset state
        setPreviewImageUri(null);
      }

      setShowAccountSheet(false);
      setUploading(false);
      setUploadProgress(0);
    } catch (error) {
      console.error("Account action error:", error);
      Alert.alert("Error", "Failed to update account");
    }
  };

  const getSheetHeight = () => {
    switch (accountAction) {
      case "demographics":
        return 500;
      case "avatar":
        return 350;
      default:
        return 300;
    }
  };

  const renderAccountSheet = () => {
    return (
      <View style={styles.sheetContent}>
        <Text style={styles.sheetTitle}>
          {accountAction === "name"
            ? "Update Display Name"
            : accountAction === "password"
            ? "Reset Password"
            : accountAction === "avatar"
            ? "Update Profile Photo"
            : "Update Profile Information"}
        </Text>

        {accountAction === "name" && (
          <TextInput
            style={styles.input}
            placeholder="New display name"
            value={newName}
            onChangeText={setNewName}
          />
        )}

        {accountAction === "password" && (
          <Text style={styles.passwordText}>
            We&apos;ll send password reset instructions to your email address.
          </Text>
        )}

        {accountAction === "avatar" && (
          <View style={styles.avatarOptions}>
            <TouchableOpacity
              style={styles.avatarOption}
              onPress={() => pickImage("camera")}
            >
              <Ionicons name="camera" size={30} color="#FF6B35" />
              <Text style={styles.avatarOptionText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.avatarOption}
              onPress={() => pickImage("gallery")}
            >
              <Ionicons name="image" size={30} color="#FF6B35" />
              <Text style={styles.avatarOptionText}>Choose from Gallery</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {accountAction === "demographics" && (
          <View style={styles.demographicsContainer}>
            <Text style={styles.demographicsLabel}>Age: (Required)</Text>
            <TextInput
              style={styles.input}
              placeholder="Your age"
              value={userAge}
              onChangeText={setUserAge}
              keyboardType="number-pad"
            />
            
            <Text style={styles.demographicsLabel}>Gender: (Required)</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={userGender}
                onValueChange={(itemValue) => setUserGender(itemValue)}
                style={styles.picker}
              >
                <Picker.Item label="Select gender" value="" />
                <Picker.Item label="Male" value="male" />
                <Picker.Item label="Female" value="female" />
              </Picker>
            </View>
          </View>
        )}

        {accountAction !== "avatar" && (
          <TouchableOpacity
            style={styles.sheetActionButton}
            onPress={handleAccountAction}
          >
            <Text style={styles.sheetActionButtonText}>
              {accountAction === "name"
                ? "Update Name"
                : accountAction === "password"
                ? "Send Reset Email"
                : "Save Information"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const pickImage = async (source?: "camera" | "gallery") => {
    try {
      let result;
      
      if (source === "camera") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Denied", "We need camera permissions to take a photo");
          return;
        }
        
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      } else if (source === "gallery") {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Denied", "We need media library permissions to select an image");
          return;
        }
        
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
      } else {
        // If no source is specified, show the bottom sheet with options
        setAccountAction("avatar");
        setShowAccountSheet(true);
        return;
      }

      if (!result.canceled) {
        setPreviewImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const handleSubmitFeedback = async () => {
    try {
      if (!feedbackText.trim()) {
        Alert.alert("Error", "Please enter your feedback");
        return;
      }

      const userId = auth.currentUser?.uid;
      if (!userId) return;

      await addDoc(collection(db, "feedback"), {
        userId,
        text: feedbackText.trim(),
        timestamp: new Date(),
      });

      setFeedbackText("");
      setShowFeedbackSheet(false);
      Alert.alert("Success", "Thank you for your feedback!");
    } catch (error) {
      console.error("Error submitting feedback:", error);
      Alert.alert("Error", "Failed to submit feedback. Please try again.");
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    try {
      // Show confirmation dialog
      Alert.alert(
        "Delete Review",
        "Are you sure you want to delete this review?",
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Delete", 
            style: "destructive",
            onPress: async () => {
              try {
                // Show activity indicator
                setLoadingReviews(true);
                
                // Delete from Firestore
                await deleteDoc(doc(db, "mealReviews", reviewId));
                
                // Update local state
                setUserReviews((prev) => prev.filter((review) => review.id !== reviewId));
                
                // Show success message
                Alert.alert("Success", "Review deleted successfully");
              } catch (error) {
                console.error("Error deleting review:", error);
                Alert.alert("Error", "Failed to delete review. Please try again.");
              } finally {
                setLoadingReviews(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error("Error with delete review dialog:", error);
    }
  };





  const renderAdminDashboard = () => {
    // We're removing the admin dashboard from the profile screen
    return null;
  };

  const renderLikedFoods = () => {
    if (loadingLikes) {
      return (
        <View style={styles.emptyStateContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.emptyStateText}>Loading liked meals...</Text>
        </View>
      );
    }

    if (!likedMeals || likedMeals.length === 0) {
      return (
        <View style={styles.emptyStateContainer}>
          <Text style={styles.emptyStateText}>
            You haven&apos;t liked any meals yet
          </Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => navigation.navigate("ExploreTab" as any)}
          >
            <Text style={styles.browseButtonText}>Browse dishes →</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.likedFoodsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.likedFoodsScroll}
        >
          {likedMeals.map((meal) => (
            <TouchableOpacity
              key={meal.mealId}
              style={styles.likedFoodCard}
              onPress={() => {
                handleFoodPress(meal);
              }}
            >
              <Image
                source={{ uri: meal.imageUrl }}
                style={styles.likedFoodImage}
              />
              <View style={styles.likedFoodInfo}>
                <Text style={styles.likedFoodName} numberOfLines={1}>
                  {meal.name}
                </Text>
                <Text style={styles.likedFoodCategory} numberOfLines={1}>
                  {meal.strCategory}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const handleFoodPress = (meal: any) => {
    // Use the correct nested navigation pattern with type assertion
    (navigation as any).navigate("ExploreTab", {
      screen: "FoodDetail",
      params: { foodId: meal.mealId },
    });
  };

  // Load saved food recognitions from Firestore
  const loadSavedFoods = async (userId: string) => {
    try {
      setLoadingSavedFoods(true);
      const foodsRef = collection(db, "scannedFoods");
      const q = query(foodsRef, where("userId", "==", userId));

      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const savedFoodsData = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            // Convert Firebase timestamp to date string for display
            savedAt: data.savedAt || data.timestamp?.toDate()?.toLocaleDateString() || 'Unknown date'
          };
        });
        
        // Sort by most recent, safely checking for timestamp
        savedFoodsData.sort((a: any, b: any) => {
          if (!a.timestamp || !b.timestamp) return 0;
          return b.timestamp.seconds - a.timestamp.seconds;
        });
        
        setSavedFoods(savedFoodsData);
        setLoadingSavedFoods(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error("Error loading saved foods:", error);
      setLoadingSavedFoods(false);
    }
  };

  // Delete a saved food recognition
  const handleDeleteSavedFood = async (foodId: string) => {
    try {
      await deleteDoc(doc(db, "scannedFoods", foodId));
      Alert.alert("Success", "Food recognition deleted!");
    } catch (error) {
      console.error("Error deleting food:", error);
      Alert.alert("Error", "Failed to delete food recognition");
    }
  };

  // View details of a saved food
  const handleViewFoodDetails = (food: any) => {
    Alert.alert(
      food.foodData.name,
      `Description: ${food.foodData.description}\n\nIngredients: ${food.foodData.ingredients && food.foodData.ingredients.slice(0, 2).join(", ")}\n\nCultural Info: ${food.foodData.culturalInfo}`,
      [
        { text: "Close", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: () => handleDeleteSavedFood(food.id) 
        }
      ]
    );
  };

  // Render the saved food recognitions section
  const renderSavedFoods = () => {
    if (loadingSavedFoods) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.sectionText}>Loading saved foods...</Text>
        </View>
      );
    }

    if (savedFoods.length === 0) {
      return (
        <View style={styles.emptyStateContainer}>
          <Ionicons name="fast-food-outline" size={64} color="#ccc" />
          <Text style={styles.sectionText}>
            No saved food recognitions yet.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate("FoodRecognitionTab")}
          >
            <Text style={styles.buttonText}>Scan Food Now</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.savedFoodsContainer}>
        {savedFoods.map((food) => (
          <TouchableOpacity
            key={food.id}
            style={styles.savedFoodCard}
            onPress={() => handleViewFoodDetails(food)}
          >
            <Image
              source={{ uri: food.imageUrl }}
              style={styles.savedFoodImage}
            />
            <View style={styles.savedFoodInfo}>
              <Text style={styles.savedFoodName}>{food.foodData.name}</Text>
              <Text style={styles.savedFoodDate}>{food.savedAt}</Text>
              <View style={styles.savedFoodTags}>
                {food.foodData.ingredients && food.foodData.ingredients.slice(0, 2).map((ingredient: string, idx: number) => (
                  <View key={idx} style={styles.savedFoodTag}>
                    <Text style={styles.savedFoodTagText}>{ingredient}</Text>
                  </View>
                ))}
              </View>
            </View>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteSavedFood(food.id)}
            >
              <Ionicons name="trash-outline" size={18} color="#fff" />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const loadSavedTranslations = async () => {
    if (!auth.currentUser) return;
    
    setLoadingTranslations(true);
    try {
      console.log("Loading saved translations for user:", auth.currentUser.uid);
      
      // Try using a basic query first without orderBy
      try {
        const simpleQuery = query(
          collection(db, "translations"), 
          where("userId", "==", auth.currentUser.uid)
        );
        
        const snapshot = await getDocs(simpleQuery);
        if (snapshot.empty) {
          console.log("No saved translations found");
          setSavedTranslations([]);
        } else {
          // Convert the data and sort it client-side
          const translations = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate?.() || new Date()
          }))
          .sort((a, b) => {
            // Sort by timestamp descending (newest first)
            if (!a.timestamp || !b.timestamp) return 0;
            return b.timestamp.getTime() - a.timestamp.getTime();
          });
          
          console.log(`Found ${translations.length} saved translations`);
          setSavedTranslations(translations);
        }
      } catch (error) {
        console.error("Error with basic translation query:", error);
        
        // If even the simple query fails, just show an empty state
        setSavedTranslations([]);
        Alert.alert("Error", "Failed to load your saved translations. Please try again later.");
      }
    } catch (error) {
      console.error("Error loading translations:", error);
      Alert.alert("Error", "Failed to load your saved translations");
    } finally {
      setLoadingTranslations(false);
    }
  };
  
  const toggleTranslations = () => {
    if (!showingTranslations) {
      loadSavedTranslations();
    }
    setShowingTranslations(!showingTranslations);
  };

  // Add a currency selection handler
  const handleCurrencyChange = async (currencyCode: string) => {
    try {
      await updateUserData({ preferredCurrency: currencyCode });
      setShowCurrencySelector(false);
    } catch (error) {
      console.error("Error updating currency:", error);
      Alert.alert("Error", "Failed to update currency preference. Please try again.");
    }
  };

  // Currency selector modal
  const renderCurrencySelector = () => {
    return (
      <BottomSheet
        visible={showCurrencySelector}
        onClose={() => setShowCurrencySelector(false)}
        height={400}
        title="Select Currency"
      >
        <View style={styles.currencySelectorContainer}>
          {currencies.map((currency) => (
            <TouchableOpacity
              key={currency.code}
              style={[
                styles.currencyOption,
                userData?.preferredCurrency === currency.code && styles.selectedCurrency,
              ]}
              onPress={() => handleCurrencyChange(currency.code)}
            >
              <Text style={styles.currencySymbol}>{currency.symbol}</Text>
              <View style={styles.currencyDetails}>
                <Text style={styles.currencyName}>{currency.name}</Text>
                <Text style={styles.currencyCode}>{currency.code}</Text>
              </View>
              {userData?.preferredCurrency === currency.code && (
                <Ionicons name="checkmark-circle" size={24} color="#FF6B35" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheet>
    );
  };

  const settingsSection = () => {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Settings</Text>
        <View style={styles.settingsOptions}>
          <TouchableOpacity
            style={styles.settingOption}
            onPress={() => {
              setAccountAction("name");
              setShowAccountSheet(true);
            }}
          >
            <Ionicons name="person-outline" size={24} color="#FF6B35" />
            <Text style={styles.settingText}>Change Display Name</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingOption}
            onPress={() => {
              setAccountAction("password");
              setShowAccountSheet(true);
            }}
          >
            <Ionicons name="key-outline" size={24} color="#FF6B35" />
            <Text style={styles.settingText}>Reset Password</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingOption}
            onPress={() => {
              setAccountAction("avatar");
              setShowAccountSheet(true);
            }}
          >
            <Ionicons name="image-outline" size={24} color="#FF6B35" />
            <Text style={styles.settingText}>Change Profile Picture</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.settingOption}
            onPress={() => {
              setAccountAction("demographics");
              setShowAccountSheet(true);
            }}
          >
            <Ionicons name="information-circle-outline" size={24} color="#FF6B35" />
            <Text style={styles.settingText}>Update Profile Information</Text>
          </TouchableOpacity>

          {/* Logout option */}
          <TouchableOpacity
            style={[styles.settingOption, styles.logoutOption]}
            onPress={() => auth.signOut()}
          >
            <Ionicons name="log-out-outline" size={24} color="#FF3A3A" />
            <Text style={[styles.settingText, styles.logoutTextColor]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Updated Profile Header */}
        <View style={styles.profileHeader}>
          <LinearGradient
            colors={['rgba(255,107,53,0.8)', 'rgba(78,205,196,0.6)']}
            style={styles.headerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          
          <View style={styles.profileHeaderContent}>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={() => {
                setAccountAction("avatar");
                setShowAccountSheet(true);
              }}
              activeOpacity={0.8}
            >
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.placeholderAvatar]}>
                  <Ionicons name="person" size={40} color="#FFFFFF" />
                </View>
              )}
              <View style={styles.editAvatarButton}>
                <Ionicons name="camera" size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.userInfoContainer}
              onPress={() => {
                setAccountAction("name");
                setShowAccountSheet(true);
              }}
            >
              <Text style={styles.userName}>
                {auth.currentUser?.displayName || "Anonymous User"}
              </Text>
              <Text style={styles.userEmail}>{auth.currentUser?.email}</Text>
              <View style={styles.editProfileButton}>
                <Text style={styles.editProfileText}>Edit Profile</Text>
                <Ionicons name="create-outline" size={16} color="#FF6B35" />
              </View>
            </TouchableOpacity>
          </View>
          
          {/* Activity Stats moved inside profile header */}
          <View style={styles.headerStatsContainer}>
            <View style={styles.headerStatItem}>
              <Text style={styles.headerStatNumber}>
                {3 - (subscription?.triesRemaining || 0)}/3
              </Text>
              <Text style={styles.headerStatLabel}>Countries</Text>
            </View>
            <View style={styles.headerStatItem}>
              <Text style={styles.headerStatNumber}>{likedMeals.length}</Text>
              <Text style={styles.headerStatLabel}>Liked</Text>
            </View>
            <View style={styles.headerStatItem}>
              <Text style={styles.headerStatNumber}>
                {subscription?.translationsUsed || 0}
              </Text>
              <Text style={styles.headerStatLabel}>Translations</Text>
            </View>
          </View>
        </View>
        
        {/* Subscription Status Card */}
        <View style={styles.subscriptionCard}>
          <View style={styles.subscriptionHeader}>
            <Ionicons 
              name={subscription?.plan === 'free' ? 'star-outline' : 'star'} 
              size={24} 
              color={subscription?.plan === 'free' ? '#666666' : '#FFD700'} 
            />
            <Text style={styles.subscriptionTitle}>
              {subscription?.plan === 'free' 
                ? 'Free Plan' 
                : subscription?.plan === 'basic' 
                  ? 'Basic Plan' 
                  : 'Premium Plan'}
            </Text>
          </View>
          
          <View style={styles.subscriptionDetails}>
            {subscription?.plan === 'free' && (
              <>
                <View style={styles.subscriptionInfo}>
                  <View style={styles.subscriptionDetail}>
                    <Ionicons name="scan-outline" size={18} color="#666666" />
                    <Text style={styles.detailText}>
                      {subscription.triesRemaining || 0} food scans remaining
                    </Text>
                  </View>
                  <View style={styles.subscriptionDetail}>
                    <Ionicons name="globe-outline" size={18} color="#666666" />
                    <Text style={styles.detailText}>
                      Limited country access
                    </Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.upgradeButton}
                  onPress={() => setShowSubscriptionModal(true)}
                >
                  <Text style={styles.upgradeButtonText}>Upgrade Plan</Text>
                </TouchableOpacity>
              </>
            )}
            
            {subscription?.plan === 'basic' && (
              <>
                <View style={styles.subscriptionInfo}>
                  <View style={styles.subscriptionDetail}>
                    <Ionicons name="scan-outline" size={18} color="#666666" />
                    <Text style={styles.detailText}>
                      20 food scans per month
                    </Text>
                  </View>
                  <View style={styles.subscriptionDetail}>
                    <Ionicons name="language" size={18} color="#666666" />
                    <Text style={styles.detailText}>
                      {subscription.translationsUsed || 0}/50 translations used
                    </Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.upgradeButton}
                  onPress={() => setShowSubscriptionModal(true)}
                >
                  <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
                </TouchableOpacity>
              </>
            )}
            
            {subscription?.plan === 'premium' && (
              <>
                <View style={styles.subscriptionInfo}>
                  <View style={styles.subscriptionDetail}>
                    <Ionicons name="infinite-outline" size={18} color="#666666" />
                    <Text style={styles.detailText}>
                      Unlimited food scans
                    </Text>
                  </View>
                  <View style={styles.subscriptionDetail}>
                    <Ionicons name="globe-outline" size={18} color="#666666" />
                    <Text style={styles.detailText}>
                      All countries unlocked
                    </Text>
                  </View>
                  <View style={styles.subscriptionDetail}>
                    <Ionicons name="language" size={18} color="#666666" />
                    <Text style={styles.detailText}>
                      Unlimited translations
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity 
              style={styles.actionButtonMenu}
              onPress={() => {
                setShowingTranslations(false);
                setAccountAction("demographics");
                setShowAccountSheet(true);
              }}
            >
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(78,205,196,0.1)' }]}>
                <Ionicons name="person-outline" size={24} color="#4ECDC4" />
              </View>
              <Text style={styles.actionButtonMenuText}>Profile Info</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButtonMenu}
              onPress={() => setShowFeedbackSheet(true)}
            >
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(255,107,53,0.1)' }]}>
                <Ionicons name="chatbox-outline" size={24} color="#FF6B35" />
              </View>
              <Text style={styles.actionButtonMenuText}>Send Feedback</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButtonMenu}
              onPress={() => setShowCurrencySelector(true)}
            >
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(134,101,247,0.1)' }]}>
                <Ionicons name="cash-outline" size={24} color="#8665F7" />
              </View>
              <Text style={styles.actionButtonMenuText}>Currency</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButtonMenu}
              onPress={toggleTranslations}
            >
              <View style={[styles.actionIcon, { backgroundColor: 'rgba(255,196,84,0.1)' }]}>
                <Ionicons name="language" size={24} color="#FFC454" />
              </View>
              <Text style={styles.actionButtonMenuText}>Translations</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Settings Section - use the new function */}
        {settingsSection()}

        {/* Liked Foods */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Liked Foods</Text>
          {renderLikedFoods()}
        </View>

        {/* My Reviews Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Reviews</Text>
          {loadingReviews ? (
            <ActivityIndicator color="#FF6B35" />
          ) : userReviews && userReviews.length > 0 ? (
            userReviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewMealName}>{review.mealName || "Unknown Meal"}</Text>
                  <View style={styles.reviewActions}>
                    <TouchableOpacity
                      onPress={() =>
                        navigation.navigate("ExploreTab" as any, {
                          screen: "FoodDetail",
                          params: { foodId: review.mealId },
                        })
                      }
                    >
                      <Ionicons
                        name="create-outline"
                        size={20}
                        color="#FF6B35"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteReview(review.id)}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={20}
                        color="#FF6B35"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
                <StarRating
                  rating={review.rating || 0}
                  onChange={() => {}}
                  starSize={20}
                  color="#FF6B35"
                  style={styles.reviewStars}
                />
                <Text style={styles.reviewText}>{review.reviewText || ""}</Text>
              </View>
            ))
          ) : (
            <View style={styles.emptyReviews}>
              <Ionicons name="star-outline" size={40} color="#FF6B35" />
              <Text style={styles.emptyText}>No reviews yet</Text>
              <TouchableOpacity
                style={styles.browseButton}
                onPress={() => navigation.navigate("ExploreTab" as any)}
              >
                <Text style={styles.browseButtonText}>Browse meals →</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Saved Foods Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Saved Foods</Text>
          {renderSavedFoods()}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Saved Translations</Text>
          {loadingTranslations ? (
            <ActivityIndicator size="large" color="#FF6B35" />
          ) : !showingTranslations ? (
            <TouchableOpacity 
              style={[styles.button, {alignSelf: "center"}]}
              onPress={toggleTranslations}
            >
              <Text style={styles.buttonText}>
                View Saved Translations
              </Text>
            </TouchableOpacity>
          ) : savedTranslations.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Ionicons name="language-outline" size={50} color="#ccc" />
              <Text style={styles.noTranslationsText}>
                You haven&apos;t saved any translations yet
              </Text>
              <TouchableOpacity
                style={styles.browseButton}
                onPress={() => navigation.navigate("TranslationTab" as any)}
              >
                <Text style={styles.browseButtonText}>Try Translations →</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity 
                style={[styles.button, {marginBottom: 15}]}
                onPress={toggleTranslations}
              >
                <Text style={styles.buttonText}>
                  Hide Translations
                </Text>
              </TouchableOpacity>
              
              <View style={styles.translationsContainer}>
                {savedTranslations.map((item) => (
                  <View key={item.id} style={styles.translationItem}>
                    <Text style={styles.translationDate}>
                      {new Date(item.timestamp).toLocaleDateString()}
                    </Text>
                    <Text style={styles.translationLanguage}>
                      Language: {item.targetLanguage.toUpperCase()}
                    </Text>
                    <Text style={styles.translationText}>
                      {item.translation}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Account Bottom Sheet */}
      <BottomSheet
        visible={showAccountSheet}
        onClose={() => setShowAccountSheet(false)}
        height={getSheetHeight()}
        title={
          accountAction === "name"
            ? "Update Display Name"
            : accountAction === "password"
            ? "Reset Password"
            : accountAction === "avatar"
            ? "Update Profile Photo"
            : "Update Profile Information"
        }
      >
        {renderAccountSheet()}
      </BottomSheet>

      {/* Feedback Sheet */}
      <BottomSheet
        visible={showFeedbackSheet}
        onClose={() => setShowFeedbackSheet(false)}
        height={300}
        title="Send Feedback"
      >
        <View style={styles.sheetContent}>
          <TextInput
            style={styles.feedbackInput}
            value={feedbackText}
            onChangeText={setFeedbackText}
            placeholder="Share your thoughts..."
            multiline
            numberOfLines={4}
          />
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmitFeedback}
          >
            <Text style={styles.submitButtonText}>Submit</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Currency Selector Sheet */}
      <BottomSheet
        visible={showCurrencySelector}
        onClose={() => setShowCurrencySelector(false)}
        height={400}
        title="Select Currency"
      >
        <View style={styles.currencySelectorContainer}>
          {currencies.map((currency) => (
            <TouchableOpacity
              key={currency.code}
              style={[
                styles.currencyOption,
                userData?.preferredCurrency === currency.code && styles.selectedCurrency,
              ]}
              onPress={() => handleCurrencyChange(currency.code)}
            >
              <Text style={styles.currencySymbol}>{currency.symbol}</Text>
              <View style={styles.currencyDetails}>
                <Text style={styles.currencyName}>{currency.name}</Text>
                <Text style={styles.currencyCode}>{currency.code}</Text>
              </View>
              {userData?.preferredCurrency === currency.code && (
                <Ionicons name="checkmark-circle" size={24} color="#FF6B35" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </BottomSheet>
    </View>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f8f8",
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFF8F5",
  },
  profileHeader: {
    position: "relative",
    borderRadius: 12,
    marginBottom: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  headerGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
  },
  profileHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    zIndex: 1,
  },
  avatarContainer: {
    position: "relative",
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 10,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  placeholderAvatar: {
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
  },
  editAvatarButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#FF6B35",
    padding: 5,
    borderRadius: 12,
  },
  userInfoContainer: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: "#666",
  },
  editProfileButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  editProfileText: {
    fontSize: 14,
    color: "#333",
    marginRight: 5,
  },
  subscriptionCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  subscriptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  subscriptionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginLeft: 10,
  },
  subscriptionDetails: {
    width: '100%',
  },
  subscriptionInfo: {
    marginBottom: 12,
  },
  subscriptionDetail: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  detailText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 8,
  },
  upgradeButton: {
    backgroundColor: "#FF6B35",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    width: '100%',
    marginTop: 8,
  },
  upgradeButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  actionButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonMenu: {
    alignItems: "center",
    width: '22%',
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  actionButtonMenuText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    fontWeight: "500",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 15,
  },
  headerStatsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  headerStatItem: {
    alignItems: "center",
  },
  headerStatNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FF6B35",
    marginBottom: 4,
  },
  headerStatLabel: {
    fontSize: 12,
    color: "#333",
  },
  likedFoodsContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  likedFoodsScroll: {
    paddingRight: 12,
  },
  likedFoodCard: {
    width: 120,
    marginRight: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  likedFoodImage: {
    width: "100%",
    height: 80,
    resizeMode: "cover",
  },
  likedFoodInfo: {
    padding: 8,
  },
  likedFoodName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  likedFoodCategory: {
    fontSize: 10,
    color: "#666",
  },
  emptyStateContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyStateText: {
    fontSize: 16,
    color: "#666",
    marginTop: 10,
    marginBottom: 15,
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  optionText: {
    fontSize: 16,
    color: "#333",
    marginLeft: 15,
  },
  logoutButton: {
    backgroundColor: "#FF6B35",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 20,
  },
  logoutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  sheetContent: {
    flex: 1,
    width: '100%',
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 20,
  },
  input: {
    backgroundColor: "#f8f8f8",
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 15,
  },
  avatarPicker: {
    alignItems: "center",
    marginBottom: 20,
  },
  previewAvatar: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignSelf: "center",
    marginVertical: 20,
  },
  previewAvatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#FFEEE6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  avatarPickerText: {
    color: "#FF6B35",
    fontSize: 16,
    fontWeight: "bold",
  },
  saveButton: {
    backgroundColor: "#FF6B35",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  reviewCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  reviewMealName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  reviewActions: {
    flexDirection: "row",
    gap: 10,
  },
  reviewStars: {
    marginBottom: 8,
  },
  reviewText: {
    fontSize: 14,
    color: "#666",
  },
  emptyReviews: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  feedbackButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  feedbackButtonText: {
    marginLeft: 10,
    fontSize: 16,
    color: "#333",
  },
  feedbackInput: {
    backgroundColor: "#f8f8f8",
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 15,
    height: 120,
    textAlignVertical: "top",
  },
  submitButton: {
    backgroundColor: "#FF6B35",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  browseButton: {
    borderWidth: 1,
    borderColor: "#FF6B35",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginTop: 10,
  },
  browseButtonText: {
    color: "#FF6B35",
    fontSize: 14,
    fontWeight: "bold",
  },
  adminButton: {
    position: "absolute",
    right: 0,
    top: 0,
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(76, 175, 80, 0.1)",
  },
  adminButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  adminSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: "#f8f8f8",
    borderRadius: 12,
  },
  adminTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  adminTabs: {
    flexDirection: "row",
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  adminTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  activeAdminTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#4CAF50",
  },
  adminTabText: {
    fontSize: 16,
    color: "#666",
  },
  adminContent: {
    marginTop: 16,
  },
  userItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 8,
  },
  userInfo: {
    flex: 1,
  },
  adminToggle: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  adminToggleActive: {
    backgroundColor: "#e8f5e9",
  },
  feedbackItem: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  feedbackText: {
    fontSize: 16,
    color: "#333",
    marginBottom: 8,
  },
  feedbackDate: {
    fontSize: 12,
    color: "#666",
  },
  feedbackUser: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  adminAccessArea: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 50,
    height: 50,
    backgroundColor: "transparent",
  },
  adminTooltip: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#333",
    padding: 8,
    borderRadius: 4,
  },
  adminTooltipText: {
    color: "#fff",
    fontSize: 12,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 20,
  },
  savedFoodsContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  savedFoodCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  savedFoodImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 12,
  },
  savedFoodInfo: {
    flex: 1,
  },
  savedFoodName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  savedFoodDate: {
    fontSize: 12,
    color: "#666",
  },
  savedFoodTags: {
    flexDirection: "row",
    gap: 4,
  },
  savedFoodTag: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  savedFoodTagText: {
    color: "#fff",
    fontSize: 12,
  },
  sectionText: {
    marginTop: 10,
    color: "#666",
  },
  button: {
    borderWidth: 1,
    borderColor: "#FF6B35",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  buttonText: {
    color: "#FF6B35",
    fontSize: 14,
    fontWeight: "bold",
  },
  translationsContainer: {
    marginTop: 15,
  },
  translationItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  translationDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  translationLanguage: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginBottom: 5,
  },
  translationText: {
    fontSize: 16,
    color: '#333',
  },
  noTranslationsText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  currencySelectorContainer: {
    flex: 1,
  },
  currencyOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  selectedCurrency: {
    backgroundColor: "#f8f8f8",
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: "600",
    marginRight: 12,
  },
  currencyDetails: {
    flex: 1,
  },
  currencyName: {
    fontSize: 16,
    color: "#333",
  },
  currencyCode: {
    fontSize: 14,
    color: "#666",
  },
  passwordText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },
  avatarOptions: {
    flexDirection: "row",
    gap: 10,
  },
  avatarOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
  },
  avatarOptionText: {
    fontSize: 16,
    color: "#333",
    marginLeft: 10,
  },
  sheetActionButton: {
    backgroundColor: "#FF6B35",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  sheetActionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  inputContainer: {
    marginBottom: 20,
  },
  passwordInfo: {
    marginBottom: 20,
  },
  infoIcon: {
    marginRight: 10,
  },
  passwordInfoText: {
    fontSize: 14,
    color: "#666",
  },
  avatarSelectionContainer: {
    marginBottom: 20,
  },
  previewContainer: {
    position: "relative",
  },
  cancelPreviewButton: {
    position: "absolute",
    top: 10,
    right: 10,
    padding: 5,
    borderRadius: 20,
  },
  uploadProgressContainer: {
    marginTop: 10,
    marginBottom: 20,
  },
  progressBarContainer: {
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    height: 10,
    overflow: "hidden",
  },
  progressBar: {
    backgroundColor: "#FF6B35",
    height: "100%",
  },
  uploadProgressText: {
    fontSize: 14,
    color: "#666",
    marginTop: 5,
  },
  menuActionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  disabledButton: {
    backgroundColor: "#cccccc",
    opacity: 0.7,
  },
  pickerContainer: {
    backgroundColor: "#f8f8f8",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 15,
    overflow: 'hidden',
  },
  picker: {
    width: "100%",
    height: 50,
  },
  demographicsContainer: {
    width: "100%",
    marginBottom: 20,
  },
  demographicsLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  settingsOptions: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },
  settingOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  settingText: {
    fontSize: 16,
    color: "#333",
    marginLeft: 12,
  },
  logoutOption: {
    borderBottomWidth: 0,
  },
  logoutTextColor: {
    color: "#FF3A3A",
  },
  deleteButton: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: "#FF6B35",
  },
  centeredButton: {
    alignSelf: "center",
  },
});
