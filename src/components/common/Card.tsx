import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Meal } from "../../services/mealdb-service";
import { auth, db } from "../../config/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { useAuth } from "../../contexts/AuthContext";
import { formatPrice } from "../../utils/currencyUtils";

export interface CardProps {
  title: string;
  description?: string;
  imageUrl?: string;
  price?: string;
  rating?: number;
  ratingCount?: number;
  culturalContext?: string;
  distance?: number;
  relatedMeals?: Meal[];
  onPress?: () => void;
  style?: any;
  mealId?: string;
  value?: number;
  onFindRestaurants?: () => void;
}

const Card: React.FC<CardProps> = ({
  title,
  description,
  imageUrl,
  price,
  rating,
  ratingCount,
  culturalContext,
  distance,
  relatedMeals,
  onPress,
  style,
  mealId,
  onFindRestaurants,
}) => {
  const [isLiked, setIsLiked] = useState(false);
  const { userData } = useAuth();

  useEffect(() => {
    checkIfLiked();
  }, [mealId]);

  const checkIfLiked = async () => {
    if (!mealId || !auth.currentUser) return;

    try {
      const likedMealsRef = collection(db, "likedMeals");
      const mealQuery = query(
        likedMealsRef,
        where("userId", "==", auth.currentUser.uid),
        where("mealId", "==", mealId)
      );
      const querySnapshot = await getDocs(mealQuery);
      setIsLiked(!querySnapshot.empty);
    } catch (error) {
      console.error("Error checking like status:", error);
    }
  };

  const handleLike = async () => {
    if (!mealId || !auth.currentUser) {
      Alert.alert("Error", "Please log in to save favorites");
      return;
    }

    try {
      const likedMealsRef = collection(db, "likedMeals");
      const mealQuery = query(
        likedMealsRef,
        where("userId", "==", auth.currentUser.uid),
        where("mealId", "==", mealId)
      );
      const querySnapshot = await getDocs(mealQuery);

      if (querySnapshot.empty) {
        // Add to liked meals
        await addDoc(likedMealsRef, {
          userId: auth.currentUser.uid,
          mealId: mealId,
          mealName: title,
          mealThumb: imageUrl,
          timestamp: new Date(),
        });
        setIsLiked(true);
      } else {
        // Remove from liked meals
        const docId = querySnapshot.docs[0].id;
        await deleteDoc(doc(likedMealsRef, docId));
        setIsLiked(false);
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      Alert.alert("Error", "Failed to update favorites");
    }
  };

  return (
    <TouchableOpacity style={[styles.card, style]} onPress={onPress}>
      <View style={styles.imageContainer}>
        <Image
          source={
            imageUrl
              ? { uri: imageUrl }
              : require("../../../assets/placeholder.png")
          }
          style={styles.image}
          resizeMode="cover"
        />
        <TouchableOpacity style={styles.favoriteButton} onPress={handleLike}>
          <Ionicons
            name={isLiked ? "heart" : "heart-outline"}
            size={24}
            color={isLiked ? "#FF6B35" : "#FF6B35"}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {description && (
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        )}
        {culturalContext && (
          <Text style={styles.culturalContext} numberOfLines={3}>
            {culturalContext}
          </Text>
        )}
        {relatedMeals && relatedMeals.length > 0 && (
          <View style={styles.relatedMealsContainer}>
            <Text style={styles.relatedMealsTitle}>Popular Dishes:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {relatedMeals.map((meal) => (
                <View key={meal.idMeal} style={styles.relatedMealItem}>
                  <Image
                    source={{ uri: meal.strMealThumb }}
                    style={styles.relatedMealImage}
                  />
                  <Text style={styles.relatedMealName} numberOfLines={2}>
                    {meal.strMeal}
                  </Text>
                  {meal.price && (
                    <Text style={styles.relatedMealPrice}>
                      {formatPrice(meal.price, userData?.preferredCurrency)}
                    </Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}
        {mealId && (
          <TouchableOpacity 
            style={styles.findRestaurantsButton}
            onPress={onFindRestaurants || onPress}
          >
            <Ionicons name="location-outline" size={16} color="#FFF" />
            <Text style={styles.findRestaurantsText}>Find Nearby Restaurants</Text>
          </TouchableOpacity>
        )}
        <View style={styles.footer}>
          {price && <Text style={styles.price}>{formatPrice(price, userData?.preferredCurrency)}</Text>}
          <View style={styles.rightFooter}>
            {rating && (
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={16} color="#FFD700" />
                <Text style={styles.rating}>{rating}</Text>
                {ratingCount && (
                  <Text style={styles.ratingCount}>({ratingCount})</Text>
                )}
              </View>
            )}
            {distance && (
              <Text style={styles.distance}>
                {(distance / 1000).toFixed(1)}km
              </Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    overflow: "hidden",
    marginVertical: 8,
    marginHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    position: "relative",
    height: 200,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  favoriteButton: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 20,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
    lineHeight: 20,
  },
  culturalContext: {
    fontSize: 14,
    color: "#666",
    marginBottom: 12,
    lineHeight: 20,
  },
  relatedMealsContainer: {
    marginTop: 12,
    marginBottom: 16,
  },
  relatedMealsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  relatedMealItem: {
    width: 120,
    marginRight: 12,
  },
  relatedMealImage: {
    width: 120,
    height: 90,
    borderRadius: 8,
    marginBottom: 4,
  },
  relatedMealName: {
    fontSize: 12,
    color: "#333",
    marginBottom: 2,
  },
  relatedMealPrice: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FF6B35",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rightFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  price: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FF6B35",
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  rating: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
  ratingCount: {
    marginLeft: 4,
    fontSize: 12,
    color: "#666",
  },
  distance: {
    fontSize: 12,
    color: "#666",
  },
  value: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FF6B35",
    marginTop: 8,
  },
  findRestaurantsButton: {
    backgroundColor: "#FF6B35",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  findRestaurantsText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "bold",
    marginLeft: 6,
  },
});

export default Card;
