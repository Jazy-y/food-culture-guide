import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { CompositeNavigationProp } from "@react-navigation/native";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../theme";
import { ExploreStackParamList, MainTabParamList } from "../types/navigation";
import AdminDashboardScreen from "../screens/AdminDashboardScreen";
import HomeScreen from "../screens/HomeScreen";
import ExploreScreen from "../screens/ExploreScreen";
import FoodRecognitionScreen from "../screens/FoodRecognitionScreen";
import TranslationScreen from "../screens/TranslationScreen";
import ProfileScreen from "../screens/ProfileScreen";
import FoodDetailScreen from "../screens/FoodDetailScreen";
import RestaurantFinderScreen from "../screens/RestaurantFinderScreen";
import CustomTabBar from "./CustomTabBar";

const Tab = createBottomTabNavigator<MainTabParamList>();
const ExploreStack = createNativeStackNavigator<ExploreStackParamList>();

// Create a navigator that can handle both tab and stack navigation
type NavigatorProps = CompositeNavigationProp<
  any, // this would normally be more specific
  any // this would normally be more specific
>;

const ExploreStackNavigator = () => {
  return (
    <ExploreStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <ExploreStack.Screen name="Explore" component={ExploreScreen as any} />
      <ExploreStack.Screen
        name="FoodDetail"
        component={FoodDetailScreen as React.ComponentType<any>}
      />
      <ExploreStack.Screen
        name="RestaurantFinder"
        component={RestaurantFinderScreen as React.ComponentType<any>}
      />
    </ExploreStack.Navigator>
  );
};

const TabNavigator: React.FC = () => {
  const theme = useTheme();
  const { userData } = useAuth();

  console.log("User data in TabNavigator:", userData);

  const isAdmin = userData && (userData.isAdmin || (userData as any).role === "admin");

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: 58,
          position: 'absolute'
        },
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: '#FF4757',
        tabBarInactiveTintColor: '#8E8E8E'
      }}
      screenListeners={({ navigation }) => ({
        tabPress: (e) => {
          // Haptic feedback could be added here
          // Vibration.vibrate(10);
        },
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: "Home",
        }}
      />
      <Tab.Screen
        name="ExploreTab"
        component={ExploreStackNavigator}
        options={{
          tabBarLabel: "Explore",
        }}
      />
      <Tab.Screen
        name="FoodRecognitionTab"
        component={FoodRecognitionScreen}
        options={{
          tabBarLabel: "Scan",
        }}
      />
      <Tab.Screen
        name="TranslationTab"
        component={TranslationScreen}
        options={{
          tabBarLabel: "Translate",
        }}
      />
      {/* Show Profile tab for regular users, Admin tab for admins */}
      {isAdmin ? (
        <Tab.Screen
          name="AdminTab"
          component={AdminDashboardScreen}
          options={{
            tabBarLabel: "Admin",
          }}
        />
      ) : (
        <Tab.Screen
          name="ProfileTab"
          component={ProfileScreen}
          options={{
            tabBarLabel: "Profile",
          }}
        />
      )}
    </Tab.Navigator>
  );
};

export default TabNavigator;
