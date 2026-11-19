import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { Ionicons } from "@expo/vector-icons";
import { mealDBService, Meal } from "../services/mealdb-service";
import {
  culturalInsightsService,
  CulturalInsight,
} from "../services/cultural-insights-service";
import { auth, db } from "../config/firebase";
import CulturalInsightCard from "../components/common/CulturalInsightCard";
import * as Location from "expo-location";
import { Restaurant as RestaurantType } from "../types";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  doc,
} from "firebase/firestore";
import StarRating from "react-native-star-rating-widget";
import NearbyRestaurants from "../components/NearbyRestaurants";
import RestaurantService from "../services/restaurant-service";
import { useAuth } from "../contexts/AuthContext";
import { formatPrice } from "../utils/currencyUtils";
import { analyticsService } from "../services/analytics-service";

type Props = NativeStackScreenProps<RootStackParamList, "FoodDetail">;

// Create an extended type that allows for string distances as well
interface LocalRestaurant extends Omit<RestaurantType, 'distance'> {
  distance: number | string;
}

export const FoodDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { foodId } = route.params;
  const { userData } = useAuth();
  const [meal, setMeal] = useState<Meal | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [insights, setInsights] = useState<CulturalInsight[]>([]);
  const [nearbyRestaurants, setNearbyRestaurants] = useState<LocalRestaurant[]>([]);
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null
  );
  const [reviews, setReviews] = useState<any[]>([]);
  const [userReview, setUserReview] = useState<{
    rating: number;
    text: string;
  }>({ rating: 0, text: "" });
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [showRestaurantFinder, setShowRestaurantFinder] = useState(false);
  const [error] = useState<string | null>(null);

  useEffect(() => {
    loadMealDetails();
    checkIfFavorite();
    getLocation();
    loadReviews();
  }, [foodId]);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        setLocation(location);
        fetchNearbyRestaurants(location);
      }
    } catch (error) {
      console.error("Error getting location:", error);
    }
  };

  const fetchNearbyRestaurants = async (
    userLocation: Location.LocationObject
  ) => {
    try {
      // Use our enhanced restaurant service
      const result = await RestaurantService.findRestaurantsForFood(
        meal?.strMeal || meal?.strCategory || "food", 
        {
          radiusInMeters: 5000, // 5km radius
          maxResults: 10,
          sortBy: 'distance'
        }
      );
      
      if (result.success) {
        // Map the RestaurantService result to the expected Restaurant type
        const mappedRestaurants = result.restaurants.slice(0, 5).map(restaurant => ({
          id: restaurant.id,
          name: restaurant.name,
          rating: restaurant.rating || 0,
          address: restaurant.address,
          distance: (restaurant.distance / 1000).toFixed(1), // Convert to km
          photoUrl: restaurant.photoUrl || 'https://via.placeholder.com/150',
          vicinity: restaurant.address,
          geometry: {
            location: {
              lat: restaurant.coordinates.latitude,
              lng: restaurant.coordinates.longitude,
            },
          },
        }));
        
        setNearbyRestaurants(mappedRestaurants);
      } else {
        console.warn("RestaurantService error:", result.errorMessage);
        setNearbyRestaurants([]); // Clear the restaurants
      }
    } catch (error) {
      console.error("Error fetching nearby restaurants:", error);
      setNearbyRestaurants([]); // Clear the restaurants on error
    }
  };

  const loadMealDetails = async () => {
    if (!foodId) {
      console.error("No foodId provided");
      setLoading(false);
      return;
    }

    try {
      const mealDetails = await mealDBService.getMealDetails(foodId);
      if (mealDetails) {
        setMeal(mealDetails);
        const ingredientsList = mealDBService.getIngredients(mealDetails);
        setIngredients(ingredientsList);

        // Track this food view in analytics
        analyticsService.trackEvent("view_food", {
          food_id: foodId,
          food_name: mealDetails.strMeal,
          food_category: mealDetails.strCategory,
          food_area: mealDetails.strArea,
        });

        // Load cultural insights
        const dishInsights = culturalInsightsService.getInsightsByDish(foodId);
        const countryInsights = mealDetails.strArea
          ? culturalInsightsService.getInsightsByCountry(mealDetails.strArea)
          : [];
        const combinedInsights = [...dishInsights];

        // Add a random country insight if we don't have dish-specific insights
        if (dishInsights.length === 0 && countryInsights.length > 0) {
          const randomInsight = mealDetails.strArea
            ? culturalInsightsService.getRandomInsight(mealDetails.strArea)
            : null;
          if (randomInsight) {
            combinedInsights.push(randomInsight);
          }
        }

        setInsights(combinedInsights);
      } else {
        Alert.alert("Error", "Failed to load meal details");
        navigation.goBack();
      }
    } catch (error) {
      console.error("Error loading meal details:", error);
      Alert.alert("Error", "Failed to load meal details");
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const checkIfFavorite = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    try {
      const likedMealsRef = collection(db, "likedMeals");
      const mealQuery = query(
        likedMealsRef,
        where("userId", "==", userId),
        where("mealId", "==", foodId)
      );
      const querySnapshot = await getDocs(mealQuery);

      if (querySnapshot.empty) {
        setIsFavorite(false);
      } else {
        setIsFavorite(true);
      }
    } catch (error) {
      console.error("Error checking favorite status:", error);
    }
  };

  const handleShare = async () => {
    if (!meal) return;

    try {
      const result = await Share.share({
        title: meal.strMeal,
        message: `Check out ${meal.strMeal} on Food Culture Guide!\n\n${meal.strInstructions}\n\nImage: ${meal.strMealThumb}`,
      });
    } catch (error) {
      Alert.alert("Error", "Failed to share meal");
    }
  };

  const toggleFavorite = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      Alert.alert("Error", "Please log in to save favorites");
      return;
    }

    try {
      const likedMealsRef = collection(db, "likedMeals");
      const mealQuery = query(
        likedMealsRef,
        where("userId", "==", userId),
        where("mealId", "==", foodId)
      );
      const querySnapshot = await getDocs(mealQuery);

      if (querySnapshot.empty) {
        // Add to liked meals
        await addDoc(likedMealsRef, {
          userId,
          mealId: foodId,
          mealName: meal?.strMeal,
          mealThumb: meal?.strMealThumb,
          timestamp: new Date(),
        });
        setIsFavorite(true);
        Alert.alert("Success", "Added to favorites");
      } else {
        // Remove from liked meals
        const docId = querySnapshot.docs[0].id;
        await deleteDoc(doc(likedMealsRef, docId));
        setIsFavorite(false);
        Alert.alert("Success", "Removed from favorites");
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      Alert.alert("Error", "Failed to update favorites");
    }
  };

  const handleRestaurantPress = (restaurant: LocalRestaurant) => {
    navigation.navigate("RestaurantDetails", { restaurant });
  };

  const loadReviews = async () => {
    if (!foodId) {
      console.error("No foodId provided");
      return;
    }

    try {
      setLoadingReviews(true);
      
      // First try to get reviews with ordering
      try {
        const reviewsQuery = query(
          collection(db, "mealReviews"),
          where("mealId", "==", foodId),
          orderBy("timestamp", "desc")
        );
        const querySnapshot = await getDocs(reviewsQuery);
        const loadedReviews = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp.toDate(),
        }));
        setReviews(loadedReviews);
      } catch (indexError) {
        console.log("Index error, falling back to simple query:", indexError);
        
        // Fallback to simple query without ordering if index is not ready
        const simpleQuery = query(
          collection(db, "mealReviews"),
          where("mealId", "==", foodId)
        );
        const querySnapshot = await getDocs(simpleQuery);
        const loadedReviews = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate?.() || new Date(),
        }))
        // Sort manually client-side
        .sort((a, b) => b.timestamp - a.timestamp);
        
        setReviews(loadedReviews);
      }
    } catch (error) {
      console.error("Error loading reviews:", error);
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!auth.currentUser) {
      Alert.alert("Error", "Please log in to submit a review");
      return;
    }

    if (userReview.rating === 0) {
      Alert.alert("Error", "Please select a rating");
      return;
    }

    try {
      // Add additional fields to ensure we have all necessary data
      const reviewData = {
        mealId: foodId,
        mealName: meal?.strMeal || "Unknown Meal",
        mealThumb: meal?.strMealThumb || "",
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || "Anonymous",
        userEmail: auth.currentUser.email || "anonymous@user.com",
        rating: userReview.rating,
        reviewText: userReview.text,
        timestamp: new Date(),
      };

      console.log("Submitting review:", reviewData);
      
      // Add the review to Firestore
      const docRef = await addDoc(collection(db, "mealReviews"), reviewData);
      console.log("Review added with ID:", docRef.id);

      // Reset review form and show success message
      setUserReview({ rating: 0, text: "" });
      
      // Add the new review to the local state to show immediately
      const newReview = {
        id: docRef.id,
        ...reviewData
      };
      setReviews(prevReviews => [newReview, ...prevReviews]);
      
      // Try to reload reviews, but don't wait for it
      loadReviews().catch(e => console.log("Error reloading reviews:", e));
      
      Alert.alert("Success", "Review submitted successfully");
    } catch (error) {
      console.error("Error submitting review:", error);
      Alert.alert("Error", "Failed to submit review. Please try again.");
    }
  };

  const handleViewMoreRestaurants = () => {
    setShowRestaurantFinder(true);
  };

  const renderRestaurantsSection = () => {
    if (nearbyRestaurants.length === 0) return null;
    
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Nearby Restaurants</Text>
          <TouchableOpacity 
            style={styles.viewMoreButton} 
            onPress={handleViewMoreRestaurants}
          >
            <Text style={styles.viewMoreText}>View All</Text>
            <Ionicons name="chevron-forward" size={16} color="#FF6B35" />
          </TouchableOpacity>
        </View>
        
        {nearbyRestaurants.slice(0, 3).map((restaurant) => (
          <TouchableOpacity
            key={restaurant.id}
            style={styles.restaurantCard}
            onPress={() => handleRestaurantPress(restaurant)}
          >
            <Image
              source={{ uri: restaurant.photoUrl }}
              style={styles.restaurantImage}
            />
            <View style={styles.restaurantInfo}>
              <Text style={styles.restaurantName}>{restaurant.name}</Text>
              <Text style={styles.restaurantAddress}>
                {restaurant.address}
              </Text>
              <Text style={styles.restaurantDistance}>
                {restaurant.distance}
              </Text>
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.rating}>{restaurant.rating}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderRestaurantFinderModal = () => {
    return (
      <Modal
        visible={showRestaurantFinder}
        animationType="slide"
        onRequestClose={() => setShowRestaurantFinder(false)}
      >
        <NearbyRestaurants 
          foodName={meal?.strMeal || "food"} 
          onClose={() => setShowRestaurantFinder(false)} 
        />
      </Modal>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  if (!meal) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load meal details</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: meal.strMealThumb }}
          style={styles.image}
          resizeMode="cover"
        />
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={toggleFavorite}
          >
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={24}
              color={isFavorite ? "#FF6B35" : "#fff"}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
            <Ionicons name="share-social" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.contentContainer}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{meal.strMeal}</Text>
            <Text style={styles.category}>{meal.strCategory}</Text>
          </View>
          {meal.price && (
            <View style={styles.priceContainer}>
              <Text style={styles.price}>
                {formatPrice(meal.price, userData?.preferredCurrency)}
              </Text>
            </View>
          )}
        </View>

        {insights.length > 0 && (
          <View style={styles.insightsSection}>
            <Text style={styles.sectionTitle}>Cultural Insights</Text>
            {insights.map((insight, index) => (
              <CulturalInsightCard
                key={insight.id}
                insight={insight}
                style={
                  index === insights.length - 1 ? styles.lastInsight : undefined
                }
              />
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ingredients</Text>
          {ingredients.map((ingredient, index) => (
            <Text key={index} style={styles.ingredient}>
              • {ingredient}
            </Text>
          ))}
        </View>

        <TouchableOpacity 
          style={styles.findRestaurantsButton}
          onPress={handleViewMoreRestaurants}
        >
          <Ionicons name="restaurant-outline" size={24} color="#fff" style={styles.buttonIcon} />
          <Text style={styles.findRestaurantsText}>Find Nearby Restaurants</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Instructions</Text>
          <Text style={styles.instructions}>{meal.strInstructions}</Text>
        </View>

        {renderRestaurantsSection()}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reviews</Text>

          {reviews.length > 0 && (
            <View style={styles.averageRatingContainer}>
              <Text style={styles.averageRatingText}>
                {(reviews.reduce((acc, review) => acc + (review.rating || 0), 0) /
                  reviews.length).toFixed(1)}
              </Text>
              <StarRating
                rating={
                  reviews.reduce((acc, review) => acc + (review.rating || 0), 0) /
                  reviews.length
                }
                onChange={() => {}}
                starSize={20}
                color="#FF6B35"
                style={styles.averageRatingStars}
              />
              <Text style={styles.reviewCount}>({reviews.length} reviews)</Text>
            </View>
          )}

          {auth.currentUser && (
            <View style={styles.reviewForm}>
              <Text style={styles.reviewFormTitle}>Write a Review</Text>
              <StarRating
                rating={userReview.rating}
                onChange={(rating) => setUserReview({ ...userReview, rating })}
                starSize={24}
                color="#FF6B35"
                style={styles.reviewFormStars}
              />
              <TextInput
                style={styles.reviewInput}
                placeholder="Share your experience..."
                value={userReview.text}
                onChangeText={(text) => setUserReview({ ...userReview, text })}
                multiline
                numberOfLines={3}
              />
              <TouchableOpacity
                style={styles.submitReviewButton}
                onPress={handleSubmitReview}
                disabled={userReview.rating === 0}
              >
                <Text style={styles.submitReviewButtonText}>Submit Review</Text>
              </TouchableOpacity>
            </View>
          )}

          {loadingReviews ? (
            <ActivityIndicator color="#FF6B35" />
          ) : reviews.length > 0 ? (
            reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewerName}>{review.userName || "Anonymous"}</Text>
                  <Text style={styles.reviewDate}>
                    {review.timestamp instanceof Date 
                      ? review.timestamp.toLocaleDateString() 
                      : new Date().toLocaleDateString()}
                  </Text>
                </View>
                <StarRating
                  rating={review.rating || 0}
                  onChange={() => {}}
                  starSize={16}
                  color="#FF6B35"
                  style={styles.reviewStars}
                />
                <Text style={styles.reviewText}>{review.reviewText || ""}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.noReviewsText}>No reviews yet</Text>
          )}
        </View>
      </View>
      
      {renderRestaurantFinderModal()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  errorText: {
    fontSize: 16,
    color: "#666",
  },
  imageContainer: {
    position: "relative",
    height: 300,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  backButton: {
    position: "absolute",
    top: 40,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtons: {
    position: "absolute",
    top: 40,
    right: 20,
    flexDirection: "row",
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
  },
  contentContainer: {
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  category: {
    fontSize: 16,
    color: "#666",
  },
  priceContainer: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  price: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  insightsSection: {
    marginBottom: 20,
  },
  lastInsight: {
    marginBottom: 0,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  viewMoreButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewMoreText: {
    fontSize: 14,
    color: "#FF6B35",
    fontWeight: "bold",
    marginRight: 5,
  },
  restaurantCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  restaurantImage: {
    width: 100,
    height: 100,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  restaurantInfo: {
    flex: 1,
    padding: 12,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  restaurantAddress: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  restaurantDistance: {
    fontSize: 12,
    color: "#FF6B35",
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  rating: {
    marginLeft: 4,
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  averageRatingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  averageRatingText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginRight: 10,
  },
  averageRatingStars: {
    marginRight: 10,
  },
  reviewCount: {
    fontSize: 14,
    color: "#666",
  },
  reviewForm: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  reviewFormTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  reviewFormStars: {
    marginBottom: 10,
  },
  reviewInput: {
    backgroundColor: "#f8f8f8",
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
  },
  submitReviewButton: {
    backgroundColor: "#FF6B35",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  submitReviewButtonText: {
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
  reviewerName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  reviewDate: {
    fontSize: 12,
    color: "#666",
  },
  reviewStars: {
    marginBottom: 8,
  },
  reviewText: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  noReviewsText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginVertical: 20,
  },
  ingredient: {
    fontSize: 16,
    color: "#666",
    marginBottom: 5,
    lineHeight: 24,
  },
  instructions: {
    fontSize: 16,
    color: "#666",
    lineHeight: 24,
  },
  findRestaurantsButton: {
    backgroundColor: "#FF6B35",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    flexDirection: "row",
  },
  buttonIcon: {
    marginRight: 10,
  },
  findRestaurantsText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default FoodDetailScreen;
