import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "../config/firebase";

/**
 * Initializes development data
 * Used to set up test data during development
 */
export const initDevData = async (): Promise<void> => {
  if (!__DEV__) return;

  const user = auth.currentUser;
  if (!user) return;

  try {
    // Check if user profile exists
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);

    // If user profile doesn't exist, create a default profile
    if (!userDoc.exists()) {
      await setDoc(userDocRef, {
        email: user.email,
        displayName: user.displayName || "User",
        createdAt: new Date().toISOString(),
        isAdmin: false,
        preferences: {
          dietaryRestrictions: [],
          favoriteCuisines: [],
          allergens: [],
        },
        usageStats: {
          dailyRecognitions: 0,
          lastReset: new Date(),
        },
        subscriptionStatus: "free",
      });
      console.log("Created default user profile in dev mode");
    }

    // Set up subscription data if it doesn't exist
    const subscriptionRef = doc(db, "subscriptions", user.uid);
    const subscriptionDoc = await getDoc(subscriptionRef);

    if (!subscriptionDoc.exists()) {
      await setDoc(subscriptionRef, {
        userId: user.uid,
        plan: "free",
        startDate: new Date(),
        endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
        status: "active",
        features: {
          dailyRecognitions: 10,
          offlineTranslations: false,
          voiceInput: false,
          culturalInsights: true,
          scansRemaining: 10,
        },
        payment: {
          amount: 0,
          currency: "USD",
          lastPayment: new Date(),
        },
      });
      console.log("Created default subscription in dev mode");
    }
  } catch (error) {
    console.error("Error initializing dev data:", error);
  }
};
