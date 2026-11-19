import { db } from "../config/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

/**
 * Initialize Firebase collections needed by the app
 * This ensures all required collections exist when a user first logs in
 */
export const initFirebaseCollections = async (userId: string): Promise<void> => {
  try {
    console.log("Initializing Firebase collections for user:", userId);
    
    // Initialize analytics collections
    const collections = [
      "analytics_events",
      "analytics_searches",
      "analytics_recognition",
      "analytics_food_stats",
      "analytics_search_terms",
      "analytics_user_stats",
      "analytics_global_stats"
    ];
    
    // Initialize core app collections
    const appCollections = [
      "users",
      "scannedFoods",
      "likedMeals",
      "mealReviews",
      "feedback",
      "translations"
    ];
    
    // Combine all collections
    const allCollections = [...collections, ...appCollections];
    
    // Create a dummy document in each collection if it doesn't exist
    for (const collectionName of allCollections) {
      // Check if collection exists by trying to access a document
      const dummyDocRef = doc(db, collectionName, "initialization");
      const dummyDocSnap = await getDoc(dummyDocRef);
      
      if (!dummyDocSnap.exists()) {
        // Create a dummy document to initialize the collection
        await setDoc(dummyDocRef, {
          initialized: true,
          createdAt: new Date().toISOString(),
          createdBy: userId,
          note: "This document was created to initialize the collection"
        });
        console.log(`Initialized collection: ${collectionName}`);
      }
    }
    
    // Initialize analytics_global_stats with food_recognition document
    const statsRef = doc(db, "analytics_global_stats", "food_recognition");
    const statsSnap = await getDoc(statsRef);
    
    if (!statsSnap.exists()) {
      await setDoc(statsRef, {
        total_attempts: 0,
        successful_attempts: 0,
        initialized: true
      });
      console.log("Initialized food_recognition stats");
    }
    
    console.log("Firebase collections initialization complete");
  } catch (error) {
    console.error("Error initializing Firebase collections:", error);
  }
}; 