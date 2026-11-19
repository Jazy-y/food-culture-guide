import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getStorage } from "firebase/storage";
import Constants from "expo-constants";
import {
  updateDoc,
} from "firebase/firestore";

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: Constants.expoConfig?.extra?.FIREBASE_API_KEY,
  authDomain: Constants.expoConfig?.extra?.FIREBASE_AUTH_DOMAIN,
  projectId: Constants.expoConfig?.extra?.FIREBASE_PROJECT_ID,
  storageBucket: Constants.expoConfig?.extra?.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: Constants.expoConfig?.extra?.FIREBASE_MESSAGING_SENDER_ID,
  appId: Constants.expoConfig?.extra?.FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Connect to Firestore emulator in development - DISABLED FOR PRODUCTION
/* 
if (__DEV__) {
  try {
    const host = "localhost"; // Local emulator host
    connectFirestoreEmulator(db, host, 8080);
    console.log("Connected to Firestore emulator at", host);
  } catch (error) {
    console.warn("Failed to connect to Firestore emulator:", error);
  }
}
*/

// Log connected environment
console.log(`Connected to Firebase: ${__DEV__ ? 'Development' : 'Production'} environment`);

// Set up auth state persistence
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("User is signed in:", user.uid);
    // Check for admin status and update local data
    user.getIdTokenResult().then((idTokenResult) => {
      if (idTokenResult.claims.admin) {
        console.log("User has admin privileges");
      }
    });
  } else {
    console.log("User is signed out");
  }
});

// Check if a user is authenticated
const isAuthenticated = (): boolean => {
  return !!auth.currentUser;
};

// Initialize development data
const initDevData = async () => {
  if (__DEV__) {
    try {
      // Add any development data initialization here
      console.log("Development data initialized");
    } catch (error) {
      console.error("Error initializing development data:", error);
    }
  }
};

// Export Firebase services and utilities
export { auth, db, storage, isAuthenticated, initDevData };
export default app;
