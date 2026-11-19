import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { TabScreenProps } from "../types/navigation";
import { Card } from "../components/common";
import { Ionicons } from "@expo/vector-icons";
import { mealDBService, Meal } from "../services/mealdb-service";
import {
  subscriptionService,
  UserSubscription,
  SubscriptionPlan,
} from "../services/subscription-service";
import {
  achievementService,
  Achievement,
} from "../services/achievement-service";
import { auth } from "../config/firebase";
import SubscriptionModal from "../components/common/SubscriptionModal";
import AchievementNotification from "../components/common/AchievementNotification";
import { MainTabParamList } from "../types/navigation";

type Props = TabScreenProps<"HomeTab">;

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const [selectedCountry, setSelectedCountry] = useState("American");
  const [countries, setCountries] = useState<string[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMeals, setLoadingMeals] = useState(false);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Check authentication
    if (!auth.currentUser) {
      navigation.reset({
        index: 0,
        routes: [{ name: "HomeTab" as keyof MainTabParamList }],
      });
      return;
    }

    const initialize = async () => {
      try {
        setLoading(true);
        setError(null);

        // Initialize MealDB service first
        console.log("Initializing MealDB service...");
        try {
          await mealDBService.initialize();
          console.log("MealDB service initialized successfully");
        } catch (initError) {
          console.warn("MealDB initialization had issues, continuing anyway:", initError);
          // Continue even with initialization issues
        }

        // Load countries first
        let countriesList: string[] = [];
        try {
          countriesList = await mealDBService.getCountries();
          console.log(`Loaded ${countriesList.length} countries`);
          
          // Ensure we have at least some countries
          if (countriesList.length === 0) {
            console.warn("No countries returned, using default list");
            countriesList = ["American", "Italian", "Chinese", "Mexican", "Indian", "Tunisian"];
          }
          
          setCountries(countriesList);
        } catch (countriesError) {
          console.error("Error loading countries:", countriesError);
          // Use default countries if API fails
          countriesList = ["American", "Italian", "Chinese", "Mexican", "Indian", "Tunisian"]; 
          setCountries(countriesList);
        }
        
        // Try to load user subscription
        try {
          const userSub = await loadUserSubscription();
          setSubscription(userSub);
        } catch (subscriptionError) {
          console.error("Error loading subscription:", subscriptionError);
          // Set default subscription
          setSubscription({
            plan: "free" as SubscriptionPlan,
            triesRemaining: 3,
            exploredCountries: [],
            favorites: [],
            lastReset: new Date().toISOString(),
          });
        }

        // Now load meals for American cuisine (or first country if no American)
        const defaultCountry = countriesList.includes("American") 
          ? "American" 
          : countriesList[0] || "American";
        
        console.log(`Loading meals for default country: ${defaultCountry}`);
        setSelectedCountry(defaultCountry);
        
        try {
          const countryMeals = await mealDBService.getMealsByCountry(defaultCountry);
          
          if (countryMeals.length > 0) {
            console.log(`Loaded ${countryMeals.length} meals for ${defaultCountry}`);
            setMeals(countryMeals);
          } else {
            console.warn(`No meals found for ${defaultCountry}, this should not happen`);
            // This shouldn't happen with our fixed MealDBService but just in case
            throw new Error(`No meals found for ${defaultCountry}`);
          }
        } catch (mealsError) {
          console.error(`Error loading initial meals for ${defaultCountry}:`, mealsError);
          setError(`Could not load meals. Pull to refresh or try another country.`);
        }
        
      } catch (error) {
        console.error("Initialization error:", error);
        setError("Failed to initialize. Pull down to refresh.");
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, [navigation]);

  const loadUserSubscription = async () => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      throw new Error("User not authenticated");
    }

    try {
      // Set a timeout for this operation
      const subscriptionPromise = (async () => {
        try {
          await subscriptionService.resetMonthlyTries();
          const userSub = await subscriptionService.getUserSubscription(userId);

          if (!userSub) {
            const defaultSubscription: UserSubscription = {
              plan: "free" as SubscriptionPlan,
              triesRemaining: 3,
              exploredCountries: [],
              favorites: [],
              lastReset: new Date().toISOString(),
            };
            return defaultSubscription;
          }

          return userSub;
        } catch (error) {
          console.error("Error loading subscription:", error);
          throw error;
        }
      })();
      
      // Race against a timeout
      const timeoutPromise = new Promise<UserSubscription>((_, reject) => {
        setTimeout(() => reject(new Error("Subscription loading timed out")), 5000);
      });
      
      return await Promise.race([subscriptionPromise, timeoutPromise]);
    } catch (error) {
      console.error("Failed to load subscription with timeout:", error);
      // Return a default subscription when offline
      return {
        plan: "free" as SubscriptionPlan,
        triesRemaining: 999, // Unlimited in offline mode
        exploredCountries: [],
        favorites: [],
        lastReset: new Date().toISOString(),
      };
    }
  };

  const handleCountrySelect = async (country: string, showLoading = true) => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      navigation.reset({
        index: 0,
        routes: [{ name: "HomeTab" as keyof MainTabParamList }],
      });
      return;
    }

    try {
      if (showLoading) {
        setLoadingMeals(true);
      }
      setError(null);

      // Subscription check
      try {
        const { canExplore, reason } = await subscriptionService.canExploreCountry(userId, country)
          .catch(() => ({ canExplore: true, reason: null })); // Allow in case of error

        if (!canExplore) {
          Alert.alert(
            "Subscription Required",
            reason || "Please upgrade to explore more countries"
          );
          setShowSubscriptionModal(true);
          if (showLoading) {
            setLoadingMeals(false);
          }
          return;
        }
      } catch (subError) {
        console.warn("Subscription check failed, allowing anyway:", subError);
        // Continue even if subscription check fails
      }

      // Get meals for the selected country
      try {
        console.log(`Fetching meals for ${country}...`);
        const countryMeals = await mealDBService.getMealsByCountry(country);
        
        if (countryMeals.length === 0) {
          console.warn(`No meals found for ${country}, this should not happen with fixed service`);
          setError(`No meals found for ${country}. Please try another country.`);
        } else {
          console.log(`Found ${countryMeals.length} meals for ${country}`);
          setMeals(countryMeals);
          setSelectedCountry(country);
          setError(null); // Clear any previous errors
        }
      } catch (mealsError) {
        console.error(`Error fetching meals for ${country}:`, mealsError);
        setError(`Failed to load meals for ${country}. Please try again.`);
      }

      // Update subscription and check achievements
      if (subscription && subscription.triesRemaining > 0) {
        try {
          const updatedSubscription = {
            ...subscription,
            triesRemaining: subscription.triesRemaining - 1,
            exploredCountries: [...subscription.exploredCountries, country],
          };
          setSubscription(updatedSubscription);

          if (!subscription.exploredCountries.includes(country)) {
            await subscriptionService.recordCountryExplored(userId, country)
              .catch(error => console.warn("Failed to record country explored:", error));
              
            try {
              const newAchievements = await achievementService.checkAndUpdateAchievements(userId);
              if (newAchievements.length > 0) {
                const achievementDetails = achievementService.getAchievementDetails(
                  newAchievements[0]
                );
                if (achievementDetails) {
                  setNewAchievement(achievementDetails);
                }
              }
            } catch (achievementError) {
              console.warn("Failed to update achievements:", achievementError);
              // Continue without achievements
            }
          }
        } catch (subscriptionError) {
          console.warn("Failed to update subscription:", subscriptionError);
          // Continue even if subscription update fails
        }
      }
    } catch (error) {
      console.error("Error in handleCountrySelect:", error);
      setError("Something went wrong. Pull to refresh.");
    } finally {
      if (showLoading) {
        setLoadingMeals(false);
      }
    }
  };

  const handleProfilePress = () => {
    navigation.navigate("ProfileTab");
  };

  const handleFoodPress = (meal: Meal) => {
    // Use type assertions to properly navigate to the nested stack
    (navigation as any).navigate("ExploreTab", {
      screen: "FoodDetail",
      params: { foodId: meal.idMeal },
    });
  };

  const handleFindRestaurants = (mealId: string, mealName: string) => {
    // Navigate to a restaurant finder screen with the meal information
    (navigation as any).navigate("ExploreTab", {
      screen: "RestaurantFinder",
      params: { mealId, mealName },
    });
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setError(null);
    
    // Reload current country
    handleCountrySelect(selectedCountry, false)
      .finally(() => {
        setRefreshing(false);
      });
  }, [selectedCountry]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading your food journey...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => handleCountrySelect(selectedCountry)}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {newAchievement && (
        <AchievementNotification
          achievement={newAchievement}
          onHide={() => setNewAchievement(null)}
        />
      )}

      <SubscriptionModal
        visible={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        onSelectPlan={async (plan) => {
          const userId = auth.currentUser?.uid;
          if (!userId) return;

          try {
            await subscriptionService.upgradePlan(userId, plan);
            const updatedSubscription = await loadUserSubscription();
            setSubscription(updatedSubscription);
            setShowSubscriptionModal(false);
          } catch (error) {
            console.error("Error upgrading plan:", error);
            Alert.alert("Error", "Failed to upgrade plan. Please try again.");
          }
        }}
        currentPlan={(subscription?.plan || "free") as "free" | "basic" | "premium"}
      />

      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome to</Text>
          <Text style={styles.title}>Food Culture Guide</Text>
        </View>
        <View style={styles.headerRight}>
          {subscription && subscription.plan !== "premium" && (
            <View style={styles.triesContainer}>
              <Text style={styles.triesText}>
                {subscription.triesRemaining} tries left
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.profileButton}
            onPress={handleProfilePress}
          >
            <Ionicons name="person-circle" size={32} color="#FF6B35" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#FF6B35"]}
            tintColor="#FF6B35"
          />
        }
      >
        <View style={styles.menuContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.countriesContainer}
          >
            {countries.map((country) => (
              <TouchableOpacity
                key={country}
                style={[
                  styles.countryButton,
                  selectedCountry === country && styles.countryButtonActive,
                ]}
                onPress={() => handleCountrySelect(country)}
                disabled={loadingMeals}
              >
                <Text
                  style={[
                    styles.countryText,
                    selectedCountry === country && styles.countryTextActive,
                  ]}
                >
                  {country}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {loadingMeals ? (
          <View style={styles.loadingMealsContainer}>
            <ActivityIndicator size="large" color="#FF6B35" />
            <Text style={styles.loadingText}>Loading delicious meals...</Text>
          </View>
        ) : meals.length > 0 ? (
          <>
            {meals.map((meal) => (
              <Card
                key={meal.idMeal}
                title={meal.strMeal}
                imageUrl={meal.strMealThumb}
                price={meal.price}
                rating={meal.rating}
                ratingCount={meal.ratingCount}
                mealId={meal.idMeal}
                onPress={() => handleFoodPress(meal)}
                onFindRestaurants={() => handleFindRestaurants(meal.idMeal, meal.strMeal)}
              />
            ))}
            <View style={styles.bottomPadding} />
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No meals found for this country. Please try another country.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f8f9fa",
  },
  errorText: {
    fontSize: 16,
    color: "#dc3545",
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 40,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginTop: 4,
  },
  profileButton: {
    padding: 8,
  },
  menuContainer: {
    backgroundColor: "#fff",
    paddingVertical: 15,
  },
  countriesContainer: {
    paddingHorizontal: 15,
  },
  countryButton: {
    marginRight: 15,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#f8f8f8",
  },
  countryButtonActive: {
    backgroundColor: "#FF6B35",
  },
  countryText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  countryTextActive: {
    color: "#fff",
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  contentContainer: {
    paddingBottom: 100,
  },
  loadingMealsContainer: {
    padding: 20,
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    marginTop: 50,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
  },
  bottomPadding: {
    height: 20,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  welcomeText: {
    fontSize: 16,
    color: "#666",
  },
  triesContainer: {
    backgroundColor: "#FF6B35",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 10,
  },
  triesText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
});

export default HomeScreen;
