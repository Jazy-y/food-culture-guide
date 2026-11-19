import { auth, db } from "../config/firebase";
import { doc, getDoc, setDoc, updateDoc, increment } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type SubscriptionPlan = "free" | "basic" | "premium";

export interface UserSubscription {
  plan: SubscriptionPlan;
  triesRemaining: number;
  exploredCountries: string[];
  favorites: string[];
  lastReset: string; // ISO date string
}

export const SUBSCRIPTION_PLANS: Record<
  SubscriptionPlan,
  {
    name: string;
    maxTries: number;
    price: number;
    features: string[];
  }
> = {
  free: {
    name: "Free",
    maxTries: 3,
    price: 0,
    features: [
      "3 countries per month",
      "Basic food information",
      "Save favorites",
    ],
  },
  basic: {
    name: "Basic",
    maxTries: 5,
    price: 4.99,
    features: [
      "5 countries per month",
      "Detailed food information",
      "Save favorites",
      "Cultural insights",
      "Share on social media",
    ],
  },
  premium: {
    name: "Premium",
    maxTries: -1, // Unlimited
    price: 9.99,
    features: [
      "Unlimited countries",
      "Detailed food information",
      "Save favorites",
      "Cultural insights",
      "Share on social media",
      "Recipe suggestions",
      "Cooking tips",
      "Monthly cultural newsletter",
    ],
  },
};

const STORAGE_KEY = "user_subscription";

export class SubscriptionService {
  private static instance: SubscriptionService;
  private subscription: UserSubscription | null = null;

  private constructor() {}

  static getInstance(): SubscriptionService {
    if (!SubscriptionService.instance) {
      SubscriptionService.instance = new SubscriptionService();
    }
    return SubscriptionService.instance;
  }

  private getUserRef(userId: string) {
    return doc(db, "users", userId);
  }

  async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    try {
      // Try to get from Firestore first
      const subscriptionDoc = await getDoc(this.getUserRef(userId));
      if (subscriptionDoc.exists()) {
        this.subscription = subscriptionDoc.data()
          .subscription as UserSubscription;
        await this.saveToLocalStorage();
        return this.subscription;
      }

      // If not in Firestore, try local storage
      return await this.getFromLocalStorage();
    } catch (error) {
      console.error("Failed to get subscription from Firestore:", error);
      return await this.getFromLocalStorage();
    }
  }

  private async getFromLocalStorage(): Promise<UserSubscription | null> {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.subscription = JSON.parse(stored) as UserSubscription;
      }
      return this.subscription;
    } catch (error) {
      console.error("Failed to get subscription from local storage:", error);
      return null;
    }
  }

  private async saveToLocalStorage() {
    try {
      if (this.subscription) {
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(this.subscription)
        );
      }
    } catch (error) {
      console.error("Failed to save subscription to local storage:", error);
    }
  }

  async initializeUser(userId: string): Promise<UserSubscription> {
    const subscription: UserSubscription = {
      plan: "free",
      triesRemaining: SUBSCRIPTION_PLANS.free.maxTries,
      exploredCountries: [],
      favorites: [],
      lastReset: new Date().toISOString(),
    };

    try {
      await setDoc(this.getUserRef(userId), { subscription }, { merge: true });
    } catch (error) {
      console.warn("Failed to initialize user in Firestore:", error);
    }

    this.subscription = subscription;
    await this.saveToLocalStorage();
    return subscription;
  }

  async canExploreCountry(
    userId: string,
    country: string
  ): Promise<{ canExplore: boolean; reason?: string }> {
    let subscription = await this.getUserSubscription(userId);

    if (!subscription) {
      subscription = await this.initializeUser(userId);
    }

    // Premium users can explore unlimited countries
    if (subscription.plan === "premium") {
      return { canExplore: true };
    }

    // Check if country was already explored
    if (subscription.exploredCountries.includes(country)) {
      return { canExplore: true };
    }

    // Check remaining tries
    if (subscription.triesRemaining <= 0) {
      return {
        canExplore: false,
        reason:
          "No tries remaining. Upgrade your plan to explore more countries!",
      };
    }

    return { canExplore: true };
  }

  async recordCountryExplored(userId: string, country: string): Promise<void> {
    let subscription = await this.getUserSubscription(userId);
    if (!subscription) {
      subscription = await this.initializeUser(userId);
    }

    // Don't decrement tries if country was already explored or user is premium
    if (
      !subscription.exploredCountries.includes(country) &&
      subscription.plan !== "premium"
    ) {
      subscription.triesRemaining--;
      subscription.exploredCountries.push(country);

      try {
        await updateDoc(this.getUserRef(userId), {
          "subscription.triesRemaining": increment(-1),
          "subscription.exploredCountries": subscription.exploredCountries,
        });
      } catch (error) {
        console.warn("Failed to update subscription in Firestore:", error);
      }

      this.subscription = subscription;
      await this.saveToLocalStorage();
    }
  }

  async upgradePlan(userId: string, newPlan: SubscriptionPlan): Promise<void> {
    const subscription: Partial<UserSubscription> = {
      plan: newPlan,
      triesRemaining: SUBSCRIPTION_PLANS[newPlan].maxTries,
      lastReset: new Date().toISOString(),
    };

    try {
      await updateDoc(this.getUserRef(userId), {
        "subscription.plan": subscription.plan,
        "subscription.triesRemaining": subscription.triesRemaining,
        "subscription.lastReset": subscription.lastReset,
      });
    } catch (error) {
      console.warn("Failed to upgrade plan in Firestore:", error);
    }

    // Update local storage
    const currentSubscription = await this.getUserSubscription(userId);
    if (currentSubscription) {
      const updatedSubscription = {
        ...currentSubscription,
        ...subscription,
      };
      this.subscription = updatedSubscription;
      await this.saveToLocalStorage();
    }
  }

  async toggleFavorite(userId: string, mealId: string): Promise<void> {
    let subscription = await this.getUserSubscription(userId);
    if (!subscription) {
      subscription = await this.initializeUser(userId);
    }

    const favorites = [...subscription.favorites];
    const index = favorites.indexOf(mealId);
    if (index === -1) {
      favorites.push(mealId);
    } else {
      favorites.splice(index, 1);
    }

    try {
      await updateDoc(this.getUserRef(userId), {
        "subscription.favorites": favorites,
      });
    } catch (error) {
      console.warn("Failed to update favorites in Firestore:", error);
    }

    subscription.favorites = favorites;
    this.subscription = subscription;
    await this.saveToLocalStorage();
  }

  async resetMonthlyTries(): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    let subscription = await this.getUserSubscription(userId);
    if (!subscription) {
      subscription = await this.initializeUser(userId);
      return;
    }

    const lastReset = new Date(subscription.lastReset);
    const now = new Date();
    const monthDiff =
      now.getMonth() -
      lastReset.getMonth() +
      (now.getFullYear() - lastReset.getFullYear()) * 12;

    if (monthDiff >= 1) {
      subscription.triesRemaining =
        SUBSCRIPTION_PLANS[subscription.plan].maxTries;
      subscription.lastReset = now.toISOString();

      try {
        await updateDoc(this.getUserRef(userId), {
          "subscription.triesRemaining": subscription.triesRemaining,
          "subscription.lastReset": subscription.lastReset,
        });
      } catch (error) {
        console.warn("Failed to reset tries in Firestore:", error);
      }

      this.subscription = subscription;
      await this.saveToLocalStorage();
    }
  }
}

export const subscriptionService = SubscriptionService.getInstance();
