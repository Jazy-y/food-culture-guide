import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { TabScreenProps } from "../types/navigation";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../config/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { mealDBService } from "../services/mealdb-service";
import { useNavigation } from "@react-navigation/native";
import { RootStackParamList } from "../types/navigation";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

type Props = TabScreenProps<"ExploreTab">;

const ExploreScreen: React.FC<Props> = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [likedMeals, setLikedMeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLikedMeals();
  }, []);

  const loadLikedMeals = async () => {
    try {
      setLoading(true);
      const userId = auth.currentUser?.uid;
      if (!userId) {
        console.error("User not logged in");
        return;
      }

      console.log("Fetching liked meals for user:", userId);

      const likedMealsQuery = query(
        collection(db, "likedMeals"),
        where("userId", "==", userId)
      );
      const querySnapshot = await getDocs(likedMealsQuery);

      console.log("Query snapshot size:", querySnapshot.size);

      const meals = await Promise.all(
        querySnapshot.docs.map(async (doc) => {
          const data = doc.data();
          console.log("Document data:", data);

          // Ensure all required fields are present
          if (!data.mealId || !data.mealName || !data.mealThumb) {
            console.error("Missing required fields in document:", data);
            return null;
          }

          try {
            // Fetch additional meal details from the API
            const mealDetails = await mealDBService.getMealDetails(data.mealId);
            if (!mealDetails) {
              console.error("Failed to fetch meal details for:", data.mealId);
              return null;
            }

            return {
              idMeal: data.mealId,
              strMeal: data.mealName,
              strMealThumb: data.mealThumb,
              strInstructions: mealDetails.strInstructions || "",
              strArea: mealDetails.strArea,
              strCategory: mealDetails.strCategory,
            };
          } catch (error) {
            console.error("Error fetching meal details:", error);
            return null;
          }
        })
      );

      const validMeals = meals.filter(Boolean);
      console.log("Processed meals:", validMeals);
      setLikedMeals(validMeals);
    } catch (error) {
      console.error("Error loading liked meals:", error);
      Alert.alert("Error", "Failed to load liked meals");
    } finally {
      setLoading(false);
    }
  };

  const renderMealItem = ({ item }: { item: any }) => {
    if (!item || !item.idMeal || !item.strMeal || !item.strMealThumb) {
      console.error("Invalid meal item:", item);
      return null;
    }

    return (
      <TouchableOpacity
        style={styles.mealCard}
        onPress={() => {
          console.log("Navigating to FoodDetail with foodId:", item.idMeal);
          navigation.navigate("FoodDetail", { foodId: item.idMeal });
        }}
      >
        <Image source={{ uri: item.strMealThumb }} style={styles.mealImage} />
        <View style={styles.mealInfo}>
          <Text style={styles.mealName}>{item.strMeal}</Text>
          <Text style={styles.mealDescription} numberOfLines={2}>
            {item.strInstructions?.substring(0, 100)}...
          </Text>
          <View style={styles.heartContainer}>
            <Ionicons name="heart" size={20} color="#FF6B35" />
          </View>
        </View>
      </TouchableOpacity>
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
      <View style={styles.header}>
        <Text style={styles.title}>Liked Meals</Text>
        <Text style={styles.subtitle}>Your favorite dishes</Text>
      </View>

      {likedMeals.length > 0 ? (
        <FlatList
          data={likedMeals}
          renderItem={renderMealItem}
          keyExtractor={(item) => item.idMeal}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="heart-outline" size={60} color="#FF6B35" />
          <Text style={styles.emptyText}>No liked meals yet</Text>
          <Text style={styles.emptySubtext}>
            Like some meals to see them here
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF8F5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFF8F5",
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 5,
  },
  listContent: {
    padding: 20,
  },
  mealCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    overflow: "hidden",
  },
  mealImage: {
    width: "100%",
    height: 200,
    resizeMode: "cover",
  },
  mealInfo: {
    padding: 15,
  },
  mealName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  mealDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 10,
  },
  heartContainer: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 20,
    padding: 5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 16,
    color: "#666",
    marginTop: 10,
    textAlign: "center",
  },
});

export default ExploreScreen;
