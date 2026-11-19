import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  FlatList,
  ActivityIndicator,
  Modal,
  TextInput,
  } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { db, auth } from "../config/firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
  deleteDoc,
  collectionGroup,
  onSnapshot,
  getDoc,
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { TabScreenProps } from "../types/navigation";
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
// TODO: Fix SVG rendering issues with Victory charts
// import { VictoryChart, VictoryLine, VictoryBar } from "victory-native";
import { mealDBService } from "../services/mealdb-service";

interface User {
  id: string;
  email?: string;
  isAdmin: boolean;
  name?: string;
  displayName?: string;
  createdAt: any; // Timestamp or string
  lastLogin?: any; // Timestamp or string
  plan?: string;
}

interface Restaurant {
  id: string;
  name: string;
  status: "pending" | "approved" | "rejected";
}

interface MonthData {
  label: string;
  date: Date;
  signups: number;
  premiumSignups: number;
}

type Props = TabScreenProps<"AdminTab">;

export const AdminDashboardScreen: React.FC<Props> = ({ navigation: tabNavigation }) => {
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { userData, logout } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [pendingRestaurants, setPendingRestaurants] = useState<Restaurant[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  // Initialize metric states with initial values
  const [totalUsers, setTotalUsers] = useState(0);
  const [usersJoinedToday, setUsersJoinedToday] = useState(0);
  const [totalDishes, setTotalDishes] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);
  const [premiumSubs, setPremiumSubs] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);

  // Initialize chart data with empty arrays (will be populated with real data)
  const [discoveryTrendsData, setDiscoveryTrendsData] = useState<
    { x: string; y: number }[]
  >([]);
  const [subscriptionGrowthData, setSubscriptionGrowthData] = useState<
    { x: string; y: number }[]
  >([]);

  // Add state for user edit modal
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<{id: string, name: string, email: string}>({id: '', name: '', email: ''});
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Add state for pagination
  const [page, setPage] = useState(0);
  const [usersPerPage, setUsersPerPage] = useState(50); // Show 50 users at a time

  // Calculate paginated user list
  const paginatedUsers = useMemo(() => {
    return users;
  }, [users]);

  // Function to load more users when reaching the end of the list
  const loadMoreUsers = () => {
    setPage(prevPage => prevPage + 1);
    setUsersPerPage(prevUsersPerPage => prevUsersPerPage + 50);
  };

  // Function to render footer with load more button
  const renderFooter = () => {
    if (users.length <= usersPerPage) {
      return null; // No more users to load
    }
    return (
      <TouchableOpacity 
        style={styles.loadMoreButton}
        onPress={loadMoreUsers}
      >
        <Text style={styles.loadMoreButtonText}>Load More Users</Text>
      </TouchableOpacity>
    );
  };

  // Set up real-time listeners when component mounts
  useEffect(() => {
    setLoading(true);
    console.log("Setting up real-time listeners...");

    // Create an array to store all unsubscribe functions
    const unsubscribers: (() => void)[] = [];

    // 1. Listen for users collection changes
    try {
      const usersRef = collection(db, "users");
      const usersUnsubscribe = onSnapshot(
        usersRef,
        (snapshot) => {
          // Process users for the admin list
          const usersList: User[] = [];
          snapshot.forEach((doc) => {
            // Add validation to ensure we have valid data
            const data = doc.data();
            usersList.push({
              id: doc.id,
              email: data.email || '',
              isAdmin: Boolean(data.isAdmin),
              name: data.name || '',
              displayName: data.displayName || '',
              createdAt: data.createdAt || null,
              lastLogin: data.lastLogin || null,
              plan: data.plan || 'free'
            } as User);
          });
          setUsers(usersList);

          // Calculate total users
          setTotalUsers(snapshot.size);

          // Calculate users joined today
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          // Calculate active and premium users
          let activeCount = 0;
          let premiumCount = 0;
          let todayCount = 0;

          snapshot.forEach((doc) => {
            const userData = doc.data();

            // Count today's users
            if (userData.createdAt) {
              const creationDate = userData.createdAt.toDate
                ? userData.createdAt.toDate()
                : new Date(userData.createdAt);

              if (creationDate >= today) {
                todayCount++;
              }
            }

            // Count active users (logged in within last 30 days)
            if (userData.lastLogin) {
              const lastMonth = new Date();
              lastMonth.setMonth(lastMonth.getMonth() - 1);

              const lastLoginDate = userData.lastLogin.toDate
                ? userData.lastLogin.toDate()
                : new Date(userData.lastLogin);

              if (lastLoginDate >= lastMonth) {
                activeCount++;
              }
            }

            // Count premium subscribers
            if (userData.plan === "premium") {
              premiumCount++;
            }
          });

          setUsersJoinedToday(todayCount);
          setActiveUsers(activeCount);
          setPremiumSubs(premiumCount);

          // Generate chart data from user data
          generateChartsFromUserData(snapshot.docs);

          console.log(
            `Processed ${snapshot.size} users, ${activeCount} active, ${premiumCount} premium`
          );
        },
        (error) => {
          console.error("Error listening to users collection:", error);
          Alert.alert("Error", "Failed to fetch user data");
        }
      );

      unsubscribers.push(usersUnsubscribe);
    } catch (error) {
      console.error("Error setting up users listener:", error);
    }

    // 2. Count dishes using the mealDBService
    try {
      // Load total dishes count from API
      loadTotalDishesCount();
    } catch (error) {
      console.error("Error counting dishes:", error);
    }

    // 3. Listen for reviews
    try {
      const reviewsRef = collection(db, "mealReviews");
      const reviewsUnsubscribe = onSnapshot(
        reviewsRef,
        (snapshot) => {
          setTotalReviews(snapshot.size);
          console.log(`Found ${snapshot.size} reviews in direct collection`);
        },
        (error) => {
          console.log("Error or empty reviews collection:", error);

          // Try collectionGroup if direct collection fails
          try {
            const groupReviewsUnsubscribe = onSnapshot(
              collectionGroup(db, "reviews"),
              (snapshot) => {
                setTotalReviews(snapshot.size);
                console.log(
                  `Found ${snapshot.size} reviews using collectionGroup`
                );
              },
              (error) =>
                console.log("Error with collectionGroup reviews:", error)
            );

            unsubscribers.push(groupReviewsUnsubscribe);
          } catch (directError) {
            console.error(
              "Error setting up collectionGroup reviews listener:",
              directError
            );
          }
        }
      );

      unsubscribers.push(reviewsUnsubscribe);
    } catch (error) {
      console.error("Error setting up reviews listener:", error);
    }

    // 4. Listen for restaurants
    try {
      const restaurantsRef = collection(db, "restaurants");
      const pendingQuery = query(
        restaurantsRef,
        where("status", "==", "pending")
      );

      const restaurantsUnsubscribe = onSnapshot(
        pendingQuery,
        (snapshot) => {
          const restaurantsList = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Restaurant[];

          setPendingRestaurants(restaurantsList);
          console.log(`Found ${restaurantsList.length} pending restaurants`);
        },
        (error) => {
          console.log("Error or empty restaurants collection:", error);
        }
      );

      unsubscribers.push(restaurantsUnsubscribe);
    } catch (error) {
      console.error("Error setting up restaurants listener:", error);
    }

    // Complete loading
    setLoading(false);

    // Cleanup function to unsubscribe from all listeners when component unmounts
    return () => {
      console.log("Cleaning up real-time listeners");
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  // Generate chart data from actual user data
  const generateChartsFromUserData = (userDocs: any[]) => {
    // Create a map for the last 6 months
    const months: MonthData[] = [];
    const now = new Date();

    // Setup month labels going back 6 months
    for (let i = 5; i >= 0; i--) {
      const month = new Date(now);
      month.setMonth(month.getMonth() - i);
      months.push({
        label: month.toLocaleDateString("default", { month: "short" }),
        date: new Date(month.getFullYear(), month.getMonth(), 1), // First day of month
        signups: 0,
        premiumSignups: 0,
      });
    }

    // Process each user document
    userDocs.forEach((userDoc) => {
      const userData = userDoc.data();

      // Get user creation date (from Firestore timestamp or string)
      let creationDate: Date | null = null;

      if (userData.createdAt) {
        if (userData.createdAt.toDate) {
          // It's a Firestore Timestamp
          creationDate = userData.createdAt.toDate();
        } else if (typeof userData.createdAt === "string") {
          // It's a date string
          creationDate = new Date(userData.createdAt);
        }
      }

      if (creationDate && !isNaN(creationDate.getTime())) {
        // Find which month this user belongs to (if within our 6-month window)
        for (const month of months) {
          const nextMonthDate = new Date(month.date);
          nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);

          if (creationDate >= month.date && creationDate < nextMonthDate) {
            month.signups++;

            // Also track premium signups separately
            if (userData.plan === "premium") {
              month.premiumSignups++;
            }
            break; // Found the right month, no need to check others
          }
        }
      }
    });

    // Create chart data arrays from the processed month data
    const discoveryData = months.map((month) => ({
      x: month.label,
      y: month.signups,
    }));

    const subscriptionData = months.map((month) => ({
      x: month.label,
      y: month.premiumSignups,
    }));

    console.log("Generated chart data:", { discoveryData, subscriptionData });

    setDiscoveryTrendsData(discoveryData);
    setSubscriptionGrowthData(subscriptionData);
  };

  // New function to load the total number of dishes from all countries
  const loadTotalDishesCount = async () => {
    try {
      console.log("Counting total dishes from mealDBService...");
      
      // Get list of all available countries
      const countries = await mealDBService.getCountries();
      console.log(`Got ${countries.length} countries to count dishes from`);
      
      // Use a Set to track unique meal IDs (to avoid duplicates across countries)
      const uniqueMealIds = new Set<string>();
      
      // Load meals for each country and count them
      const countPromises = countries.map(async (country) => {
        try {
          const meals = await mealDBService.getMealsByCountry(country);
          
          // Add each meal ID to the Set
          meals.forEach(meal => uniqueMealIds.add(meal.idMeal));
          
          console.log(`Loaded ${meals.length} dishes from ${country}`);
          return meals.length;
        } catch (error) {
          console.log(`Error counting dishes for ${country}:`, error);
          return 0;
        }
      });
      
      // Wait for all counting to complete
      await Promise.all(countPromises);
      
      // Get the total unique meal count
      const totalUniqueCount = uniqueMealIds.size;
      
      // If we have any dishes, update the count state
      if (totalUniqueCount > 0) {
        console.log(`Counted ${totalUniqueCount} unique dishes across all countries`);
        setTotalDishes(totalUniqueCount);
      } else {
        // As a fallback, use the count of dishes in the fallback data
        const fallbackCount = Object.values(mealDBService['fallbackMeals'] || {}).reduce(
          (total, meals) => total + (Array.isArray(meals) ? meals.length : 0),
          0
        );
        
        console.log(`Using fallback dish count: ${fallbackCount}`);
        setTotalDishes(fallbackCount > 0 ? fallbackCount : 250); // Default to 250 if all else fails
      }
    } catch (error) {
      console.error("Error counting total dishes:", error);
      // Use a reasonable default value if we can't get the real count
      setTotalDishes(250);
    }
  };

  const toggleAdminStatus = async (userId: string, currentStatus: boolean) => {
    try {
      // Only allow to update other users, not the current admin (prevent self-demotion)
      if (userId === auth.currentUser?.uid) {
        Alert.alert("Error", "You cannot change your own admin status");
        return;
      }

      // Get a reference to the user document
      const userDoc = doc(db, "users", userId);
      
      // Check if the current user is an admin in Firestore
      const adminRef = doc(db, "users", auth.currentUser?.uid || "");
      const adminDoc = await getDoc(adminRef);
      
      if (!adminDoc.exists() || !adminDoc.data().isAdmin) {
        Alert.alert("Error", "You don't have permission to change admin status");
        return;
      }
      
      // Update the user's admin status
      await updateDoc(userDoc, {
        isAdmin: !currentStatus,
        updatedAt: new Date().toISOString(),
      });

      // Update the local state
      setUsers(
        users.map((user) =>
          user.id === userId ? { ...user, isAdmin: !currentStatus } : user
        )
      );

      Alert.alert(
        "Success",
        `User admin status ${currentStatus ? "removed" : "granted"}`
      );
    } catch (error) {
      console.error("Error updating admin status:", error);
      Alert.alert("Error", "Failed to update admin status. Make sure you have the required permissions.");
    }
  };

  const handleRestaurantStatus = async (
    restaurantId: string,
    status: "approved" | "rejected"
  ) => {
    try {
      const restaurantRef = doc(db, "restaurants", restaurantId);
      await updateDoc(restaurantRef, {
        status,
      });

      // Remove from pending list
      setPendingRestaurants(
        pendingRestaurants.filter((item) => item.id !== restaurantId)
      );

      Alert.alert(
        "Success",
        `Restaurant ${status === "approved" ? "approved" : "rejected"}`
      );
    } catch (error) {
      console.error(`Error ${status} restaurant:`, error);
      Alert.alert("Error", `Failed to ${status} restaurant`);
    }
  };

  // Replace the prompt function with our own modal
  const editUserDetails = async (
    userId: string,
    currentName: string,
    currentEmail: string
  ) => {
    setEditingUser({id: userId, name: currentName, email: currentEmail});
    setNewName(currentName);
    setNewEmail(currentEmail);
    setEditModalVisible(true);
  };

  // Confirm the edit user action
  const confirmEditUser = async () => {
    try {
      if (newName === editingUser.name && newEmail === editingUser.email) {
        Alert.alert("Info", "No changes were made");
        setEditModalVisible(false);
        return;
      }

      // Check if the current user is an admin in Firestore
      const adminRef = doc(db, "users", auth.currentUser?.uid || "");
      const adminDoc = await getDoc(adminRef);
      
      if (!adminDoc.exists() || !adminDoc.data().isAdmin) {
        Alert.alert("Error", "You don't have permission to update user details");
        setEditModalVisible(false);
        return;
      }

      // Update the user document
      const userDoc = doc(db, "users", editingUser.id);
      await updateDoc(userDoc, {
        displayName: newName,
        name: newName,
        email: newEmail,
        updatedAt: new Date().toISOString(),
      });

      // Update local state
      setUsers(users.map(user => 
        user.id === editingUser.id 
          ? {...user, name: newName, displayName: newName, email: newEmail} 
          : user
      ));

      Alert.alert("Success", "User details updated successfully");
      setEditModalVisible(false);
    } catch (error) {
      console.error("Error updating user details:", error);
      Alert.alert("Error", "Failed to update user details. Check your permissions.");
    }
  };

  const deleteUser = async (userId: string) => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this user? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "users", userId));
              Alert.alert("Success", "User deleted");
              // Users will be updated via the listener
            } catch (error) {
              console.error("Error deleting user:", error);
              Alert.alert("Error", "Failed to delete user");
            }
          }
        }
      ]
    );
  };

  // Handle logout
  const handleLogout = async () => {
    Alert.alert(
      "Confirm Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Logout",
          onPress: async () => {
            try {
              await logout();
              // Navigation will be handled by auth state listener
            } catch (error) {
              console.error("Error logging out:", error);
              Alert.alert("Error", "Failed to logout");
            }
          }
        }
      ]
    );
  };

  // Format date with fallback
  const formatDate = (dateString: any) => {
    if (!dateString) return "—";

    let date: Date;
    if (dateString.toDate) {
      // It's a Firestore Timestamp
      date = dateString.toDate();
    } else if (typeof dateString === "string") {
      // It's a string
      date = new Date(dateString);
    } else {
      // Unknown format
      return "Date unavailable";
    }

    return isNaN(date.getTime())
      ? "Date unavailable"
      : date.toLocaleDateString();
  };

  const renderUserItem = ({ item }: { item: User }) => {
    // Use the actual user name if available or email as fallback
    // Add null check before splitting email
    const displayName =
      item.name || item.displayName || (item.email ? item.email.split("@")[0] : "Unknown User");

    return (
      <View style={styles.userItem}>
        <View style={styles.userInfo}>
          <Text style={styles.email}>{item.email || "No email"}</Text>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.date}>Joined: {formatDate(item.createdAt)}</Text>
        </View>
        <View style={styles.userActions}>
          <TouchableOpacity
            onPress={() => editUserDetails(item.id, displayName, item.email || "")}
          >
            <Ionicons name="create-outline" size={24} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => deleteUser(item.id)}>
            <Ionicons name="trash-outline" size={24} color="#FF6B6B" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.adminButton,
              item.isAdmin && styles.adminButtonActive,
            ]}
            onPress={() => toggleAdminStatus(item.id, item.isAdmin)}
          >
            <Ionicons
              name={item.isAdmin ? "shield-checkmark" : "shield-outline"}
              size={24}
              color={item.isAdmin ? "#4CAF50" : "#666"}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderMetrics = () => (
    <View style={styles.metricsContainer}>
      <View style={styles.metricCard}>
        <Ionicons
          name="restaurant"
          size={24}
          color="#FF6B35"
          style={styles.metricIcon}
        />
        <Text style={styles.metricTitle}>Total Dishes</Text>
        <Text style={styles.metricValue}>{totalDishes || "—"}</Text>
      </View>
      <View style={styles.metricCard}>
        <Ionicons
          name="people"
          size={24}
          color="#4CAF50"
          style={styles.metricIcon}
        />
        <Text style={styles.metricTitle}>Active Users</Text>
        <Text style={styles.metricValue}>{activeUsers || "—"}</Text>
      </View>
      <View style={styles.metricCard}>
        <Ionicons
          name="star"
          size={24}
          color="#FFD700"
          style={styles.metricIcon}
        />
        <Text style={styles.metricTitle}>Premium Subs</Text>
        <Text style={styles.metricValue}>{premiumSubs || "—"}</Text>
      </View>
      <View style={styles.metricCard}>
        <Ionicons
          name="chatbubbles"
          size={24}
          color="#2196F3"
          style={styles.metricIcon}
        />
        <Text style={styles.metricTitle}>Total Reviews</Text>
        <Text style={styles.metricValue}>{totalReviews || "—"}</Text>
      </View>
    </View>
  );

  const renderCharts = () => (
    <View style={styles.chartsContainer}>
      <View style={styles.chartPlaceholder}>
        <Text style={styles.chartPlaceholderText}>Discovery Trends Chart</Text>
        {discoveryTrendsData.length > 0 ? (
          <View style={styles.chartDataContainer}>
            {discoveryTrendsData.map((point, index) => (
              <View key={index} style={styles.dataPoint}>
                <Text style={styles.dataPointLabel}>{point.x}</Text>
                <View
                  style={[
                    styles.dataBar,
                    { height: Math.min(point.y * 2, 100) },
                  ]}
                />
                <Text style={styles.dataPointValue}>{point.y}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noDataText}>No data available</Text>
        )}
      </View>
      <View style={styles.chartPlaceholder}>
        <Text style={styles.chartPlaceholderText}>
          Subscription Growth Chart
        </Text>
        {subscriptionGrowthData.length > 0 ? (
          <View style={styles.chartDataContainer}>
            {subscriptionGrowthData.map((point, index) => (
              <View key={index} style={styles.dataPoint}>
                <Text style={styles.dataPointLabel}>{point.x}</Text>
                <View
                  style={[
                    styles.dataBar,
                    { height: Math.min(point.y * 3, 100) },
                  ]}
                />
                <Text style={styles.dataPointValue}>{point.y}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noDataText}>No data available</Text>
        )}
      </View>
    </View>
  );

  const refreshData = () => {
    console.log("Manual refresh requested");
    // No need to manually refresh with real-time listeners
    // But we can show a loading indicator for UI feedback
    setLoading(true);
    setTimeout(() => setLoading(false), 500);
  };

  // Function to migrate existing users to have proper profile structure
  const fixUserProfiles = async () => {
    try {
      setLoading(true);
      Alert.alert("Fixing User Profiles", "This may take a moment...");
      
      // Verify current user is admin
      const currentUserRef = doc(db, "users", auth.currentUser?.uid || "");
      const currentUserDoc = await getDoc(currentUserRef);
      
      if (!currentUserDoc.exists() || !currentUserDoc.data().isAdmin) {
        Alert.alert("Error", "You don't have admin privileges to perform this action");
        setLoading(false);
        return;
      }
      
      console.log("Starting profile migration as admin:", auth.currentUser?.uid);
      
      // Get all users
      const usersRef = collection(db, "users");
      const snapshot = await getDocs(usersRef);
      
      console.log(`Found ${snapshot.size} users to check for migration`);
      let updatedCount = 0;
      let errorCount = 0;
      
      // Process each user
      for (const userDoc of snapshot.docs) {
        try {
          const userData = userDoc.data();
          const userRef = doc(db, "users", userDoc.id);
          
          // Create a proper profile structure regardless of whether they have one already
          // This ensures all users have the standard format
          console.log(`Migrating profile for user: ${userDoc.id}`);
          
          // Calculate age from birthdate if available
          let userAge: number | null = null;
          if (userData.birthdate) {
            const birthdate = userData.birthdate.toDate ? 
              userData.birthdate.toDate() : 
              new Date(userData.birthdate);
            
            if (birthdate && !isNaN(birthdate.getTime())) {
              const today = new Date();
              userAge = today.getFullYear() - birthdate.getFullYear();
              const m = today.getMonth() - birthdate.getMonth();
              if (m < 0 || (m === 0 && today.getDate() < birthdate.getDate())) {
                userAge--;
              }
            }
          } else if (userData.age) {
            userAge = parseInt(userData.age.toString());
          } else if (userData.profile?.age) {
            userAge = parseInt(userData.profile.age.toString());
          }
          
          // Get the gender from any of the possible locations
          const gender = userData.gender?.toLowerCase() || 
                        userData.profile?.gender?.toLowerCase() || 
                        null;
                        
          // Get the location from any of the possible locations
          const location = userData.location || 
                          userData.profile?.location || 
                          null;
          
          // Create profile object with properly formatted data
          const profile = {
            gender: gender,
            age: userAge,
            location: location
          };
          
          // Update user document with proper profile structure
          await updateDoc(userRef, {
            profile: profile,
            updatedAt: new Date().toISOString()
          });
          
          updatedCount++;
        } catch (userError) {
          console.error(`Error updating user ${userDoc.id}:`, userError);
          errorCount++;
        }
      }
      
      if (updatedCount > 0) {
        Alert.alert("Success", `Updated ${updatedCount} user profiles successfully. ${errorCount} errors encountered.`);
      } else {
        Alert.alert("Error", `Failed to update profiles. ${errorCount} errors encountered.`);
      }
    } catch (error) {
      console.error("ERROR Error fixing user profiles:", error);
      Alert.alert("Error", "Failed to fix user profiles: " + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Function to populate sample user data for testing
  const populateTestData = async () => {
    try {
      setLoading(true);
      Alert.alert("Populating Test Data", "This will update the demographic data of existing users with test values. Continue?", [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => setLoading(false)
        },
        {
          text: "Continue",
          onPress: async () => {
            try {
              // Verify current user is admin
              const currentUserRef = doc(db, "users", auth.currentUser?.uid || "");
              const currentUserDoc = await getDoc(currentUserRef);
              
              if (!currentUserDoc.exists() || !currentUserDoc.data().isAdmin) {
                Alert.alert("Error", "You don't have admin privileges to perform this action");
                setLoading(false);
                return;
              }
              
              // Get all users
              const usersRef = collection(db, "users");
              const snapshot = await getDocs(usersRef);
              
              console.log(`Found ${snapshot.size} users to populate with test data`);
              let updatedCount = 0;
              
              // Sample locations
              const locations = [
                "New York, USA", 
                "London, UK", 
                "Tokyo, Japan", 
                "Paris, France", 
                "Sydney, Australia",
                "Berlin, Germany",
                "Toronto, Canada",
                "Mumbai, India",
                "São Paulo, Brazil",
                "Cairo, Egypt"
              ];
              
              // Process each user
              for (const userDoc of snapshot.docs) {
                try {
                  const userData = userDoc.data();
                  const userRef = doc(db, "users", userDoc.id);
                  
                  // Generate random age between 18 and 65
                  const age = Math.floor(Math.random() * 48) + 18;
                  
                  // Generate random gender
                  const genders = ["male", "female"];
                  const gender = genders[Math.floor(Math.random() * genders.length)];
                  
                  // Select random location
                  const location = locations[Math.floor(Math.random() * locations.length)];
                  
                  // Create updated profile with test data
                  const profile = {
                    ...(userData.profile || {}),
                    age: age,
                    gender: gender,
                    location: location
                  };
                  
                  // Update user document
                  await updateDoc(userRef, {
                    profile: profile,
                    updatedAt: new Date().toISOString()
                  });
                  
                  updatedCount++;
                } catch (error) {
                  console.error(`Error updating test data for user ${userDoc.id}:`, error);
                }
              }
              
              Alert.alert("Success", `Updated ${updatedCount} users with test demographic data.`);
              
              // Refresh data
              refreshData();
            } catch (error) {
              console.error("Error populating test data:", error);
              Alert.alert("Error", "Failed to populate test data: " + (error as Error).message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]);
    } catch (error) {
      console.error("Error in populateTestData:", error);
      setLoading(false);
    }
  };

  if (!userData?.isAdmin) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Access Denied</Text>
        <Text style={styles.errorSubtext}>
          You do not have permission to view this page.
        </Text>
      </View>
    );
  }

  return (
    <>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Loading admin dashboard...</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={paginatedUsers}
            renderItem={renderUserItem}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No users found</Text>
              </View>
            }
            ListHeaderComponent={
              <View style={styles.container}>
                <View style={styles.headerRow}>
                  <Text style={styles.title}>Admin Dashboard</Text>
                  <View style={styles.headerActions}>
                    <TouchableOpacity 
                      style={styles.analyticsButton}
                      onPress={() => rootNavigation.navigate('AnalyticsDashboard')}
                    >
                      <Ionicons name="analytics" size={22} color="#fff" />
                      <Text style={styles.analyticsButtonText}>Advanced Analytics</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.fixProfilesButton}
                      onPress={fixUserProfiles}
                    >
                      <Ionicons name="construct" size={22} color="#fff" />
                      <Text style={styles.fixProfilesButtonText}>Fix User Profiles</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.testDataButton}
                      onPress={populateTestData}
                    >
                      <Ionicons name="flask" size={22} color="#fff" />
                      <Text style={styles.testDataButtonText}>Test Data</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.logoutButton}
                      onPress={handleLogout}
                    >
                      <Ionicons name="log-out-outline" size={22} color="#fff" />
                      <Text style={styles.logoutButtonText}>Logout</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.refreshButton}
                      onPress={refreshData}
                    >
                      <Ionicons name="refresh" size={24} color="#FF6B35" />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.subtitle}>User Management</Text>
                {renderMetrics()}
                {renderCharts()}
              </View>
            }
            contentContainerStyle={styles.listContainer}
            ListFooterComponent={
              <>
                {renderFooter()}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Pending Restaurants</Text>
                  {pendingRestaurants.length > 0 ? (
                    pendingRestaurants.map((restaurant) => (
                      <View key={restaurant.id} style={styles.restaurantCard}>
                        <Text style={styles.restaurantName}>{restaurant.name}</Text>
                        <View style={styles.restaurantActions}>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.approveButton]}
                            onPress={() =>
                              handleRestaurantStatus(restaurant.id, "approved")
                            }
                          >
                            <Text style={styles.actionButtonText}>Approve</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.rejectButton]}
                            onPress={() =>
                              handleRestaurantStatus(restaurant.id, "rejected")
                            }
                          >
                            <Text style={styles.actionButtonText}>Reject</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  ) : (
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>
                        No pending restaurants found
                      </Text>
                    </View>
                  )}
                </View>
              </>
            }
          />

          {/* User Edit Modal */}
          <Modal
            visible={isEditModalVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setEditModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Edit User</Text>
                
                <Text style={styles.inputLabel}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="User name"
                />
                
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={newEmail}
                  onChangeText={setNewEmail}
                  placeholder="Email address"
                  keyboardType="email-address"
                />
                
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => setEditModalVisible(false)}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton]}
                    onPress={confirmEditUser}
                  >
                    <Text style={styles.saveButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    flexWrap: "wrap",
    minHeight: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  subtitle: {
    fontSize: 18,
    color: "#666",
    marginBottom: 20,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  listContainer: {
    paddingBottom: 20,
  },
  userItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#f8f8f8",
    borderRadius: 10,
    marginBottom: 10,
  },
  userInfo: {
    flex: 1,
  },
  userActions: {
    flexDirection: "row",
    gap: 12,
  },
  email: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  userName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#444",
    marginTop: 2,
  },
  date: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  adminButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  adminButtonActive: {
    backgroundColor: "#e8f5e9",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 16,
  },
  restaurantCard: {
    backgroundColor: "#f5f5f5",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  restaurantName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  restaurantActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  approveButton: {
    backgroundColor: "#4CAF50",
  },
  rejectButton: {
    backgroundColor: "#FF6B6B",
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  loadingContainer: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    fontStyle: "italic",
  },
  errorText: {
    fontSize: 14,
    color: '#e74c3c',
  },
  errorSubtext: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  metricsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 25,
    marginHorizontal: -8,
  },
  metricCard: {
    width: "48%",
    minWidth: 130,
    padding: 16,
    margin: 4,
    borderRadius: 12,
    backgroundColor: "#f9f9f9",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 12,
  },
  metricIcon: {
    marginBottom: 10,
  },
  metricTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 8,
    textAlign: "center",
  },
  metricValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FF6B35",
    textAlign: "center",
  },
  chartsContainer: {
    marginVertical: 20,
  },
  chartPlaceholder: {
    backgroundColor: "#f0f0f0",
    padding: 25,
    borderRadius: 8,
    margin: 10,
    alignItems: "center",
    justifyContent: "center",
    height: 180,
  },
  chartPlaceholderText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
    textAlign: "center",
  },
  chartDataContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 120,
    marginTop: 10,
    paddingHorizontal: 10,
  },
  dataPoint: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-end",
    flex: 1,
    height: "100%",
  },
  dataPointLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  dataBar: {
    width: 20,
    backgroundColor: "#FF6B35",
    borderRadius: 4,
    marginBottom: 4,
  },
  dataPointValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
  },
  noDataText: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
    marginTop: 10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF4757',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    width: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  cancelButton: {
    backgroundColor: '#f2f2f2',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  analyticsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4A69BD',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  analyticsButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  fixProfilesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#009688',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginLeft: 8,
  },
  fixProfilesButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  testDataButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginLeft: 8,
  },
  testDataButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statItem: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
  },
  warningButton: {
    backgroundColor: '#FF6B6B',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  recognitionContainer: {
    marginBottom: 10,
  },
  recognitionImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  resultContainer: {
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 10,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  resultItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  alternativesContainer: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#f0f8ff',
    borderRadius: 8
  },
  ingredientItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
    paddingLeft: 8
  },
  historyContainer: {
    marginTop: 20,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    padding: 5,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
  },
  historyImage: {
    width: 60,
    height: 60,
    borderRadius: 4,
    marginRight: 10,
  },
  historyDetails: {
    flex: 1,
  },
  historyName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  historyDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 3,
  },
  ingredientsContainer: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8
  },
  loadMoreButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
  },
  loadMoreButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default AdminDashboardScreen;
