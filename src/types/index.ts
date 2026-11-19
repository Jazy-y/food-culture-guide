export interface Restaurant {
  id: string;
  name: string;
  address: string;
  rating: number;
  priceLevel?: number;
  photos?: string[];
  photoUrl?: string;
  openingHours?: {
    open_now: boolean;
    weekday_text?: string[];
  };
  types?: string[];
  vicinity: string;
  distance?: number;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

export interface FoodData {
  name: string;
  description: string;
  ingredients: string[];
  culturalInfo: string;
  confidence: number;
  otherOptions?: Array<{name: string, confidence: number}>;
}

export interface UserData {
  displayName?: string;
  email?: string;
  photoURL?: string;
  isAdmin?: boolean;
  role?: "user" | "admin";
  preferences?: {
    dietaryRestrictions: string[];
    favoriteCuisines: string[];
    allergens: string[];
  };
}

export interface UserSubscription {
  userId: string;
  plan: "free" | "basic" | "premium";
  scansRemaining?: number;
  features?: {
    dailyRecognitions: number;
    offlineTranslations: boolean;
    voiceInput: boolean;
    culturalInsights: boolean;
    scansRemaining?: number;
  };
}

// This is now imported from './navigation'
// Keeping this here for legacy components but marking it as deprecated
/**
 * @deprecated Import from './navigation' instead
 */
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Splash: undefined;
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  Home: undefined;
  FoodDetail: { foodId: string };
  RestaurantDetails: { restaurant: Restaurant };
  CulturalInsights: { country: string };
  Test: undefined;
  Search: undefined;
  Camera: undefined;
  Profile: undefined;
  Admin: undefined;
  Explore: undefined;
};
