import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { RootStackParamList } from "./types/navigation";
import { StyleSheet } from 'react-native';

// Import screens
import FoodDetailScreen from "./screens/FoodDetailScreen";
import RestaurantDetailsScreen from "./screens/RestaurantDetailsScreen";
import CulturalInsightsScreen from "./screens/CulturalInsightsScreen";
import TabNavigator from "./navigation/TabNavigator";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import WelcomeScreen from "./screens/WelcomeScreen";
import SplashScreen from "./screens/SplashScreen";
import ProfileScreen from "./screens/ProfileScreen";
import AdminDashboardScreen from "./screens/AdminDashboardScreen";
import AnalyticsDashboardScreen from "./screens/AnalyticsDashboardScreen";
import ReviewsScreen from "./screens/ReviewsScreen";
import RestaurantFinderScreen from "./screens/RestaurantFinderScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * This file is NOT the main entry point of the application.
 * It is used to export navigation-related components to be used in the root App.tsx
 */

// Create a NavigationStack that can be imported in the main App
export const createNavigationStack = (user: any, initializing: boolean) => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {initializing ? (
        <Stack.Screen name="Splash" component={SplashScreen} />
      ) : user ? (
        <>
          <Stack.Screen name="Main" component={TabNavigator} />
          <Stack.Screen name="FoodDetail" component={FoodDetailScreen as any} />
          <Stack.Screen
            name="RestaurantDetails"
            component={RestaurantDetailsScreen as any}
          />
          <Stack.Screen
            name="CulturalInsights"
            component={CulturalInsightsScreen as any}
          />
          <Stack.Screen name="Profile" component={ProfileScreen as any} />
          <Stack.Screen name="Admin" component={AdminDashboardScreen as any} />
          <Stack.Screen name="AnalyticsDashboard" component={AnalyticsDashboardScreen as any} />
          <Stack.Screen name="Reviews" component={ReviewsScreen as any} />
          <Stack.Screen 
            name="RestaurantFinder" 
            component={RestaurantFinderScreen as any}
            initialParams={{ mealId: "", mealName: "" }}
          />
        </>
      ) : (
        <>
          <Stack.Screen name="Welcome" component={WelcomeScreen as any} />
          <Stack.Screen name="Login" component={LoginScreen as any} />
          <Stack.Screen name="Register" component={RegisterScreen as any} />
        </>
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  },
});

export default createNavigationStack;
