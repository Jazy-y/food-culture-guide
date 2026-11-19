import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { NavigatorScreenParams } from "@react-navigation/native";

// Define a nested type for Explore stack
export type ExploreStackParamList = {
  Explore: undefined;
  FoodDetail: { foodId: string };
  RestaurantFinder: { mealId: string; mealName: string };
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Splash: undefined;
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  Home: undefined;
  FoodDetail: { foodId: string };
  RestaurantDetails: { restaurant: any };
  Test: undefined;
  Achievements: undefined;
  CulturalInsights: { country: string };
  Search: undefined;
  Camera: undefined;
  Profile: undefined;
  Admin: undefined;
  Explore: undefined;
  AnalyticsDashboard: undefined;
  Reviews: undefined;
  RestaurantFinder: { mealId: string; mealName: string };
};

export type MainTabParamList = {
  HomeTab: undefined;
  ExploreTab: NavigatorScreenParams<ExploreStackParamList>;
  FoodRecognitionTab: undefined;
  TranslationTab: undefined;
  ProfileTab: undefined;
  AdminTab: undefined;
  Welcome: undefined;
  FoodDetail: { foodId: string };
};

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof MainTabParamList> =
  BottomTabScreenProps<MainTabParamList, T>;

export type FoodDetailScreenProps = {
  foodId: string;
};
