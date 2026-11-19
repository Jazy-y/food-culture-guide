import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
} from "react";
import { auth, db } from "../config/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { clearLocalStorage } from "../utils/localStorage";
import { initDevData } from "../utils/initDevData";
import { initFirebaseCollections } from "../utils/initFirebaseCollections";

interface UserData {
  email: string;
  isAdmin: boolean;
  displayName?: string;
  photoURL?: string;
  createdAt?: string;
  preferredCurrency?: string;
  gender?: string | null;
  birthdate?: string | null;
}

interface AuthContextType {
  user: FirebaseUser | null;
  userData: UserData | null;
  loading: boolean;
  initializing: boolean;
  signup: (email: string, password: string) => Promise<FirebaseUser>;
  login: (email: string, password: string) => Promise<FirebaseUser>;
  loginWithGoogle: (idToken: string) => Promise<FirebaseUser>;
  logout: () => Promise<void>;
  updateUserData: (data: Partial<UserData>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      // Clear storage in development mode
      if (__DEV__) {
        await clearLocalStorage();
      }

      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        setUser(user);

        if (user) {
          // Initialize dev data in development mode
          if (__DEV__) {
            await initDevData();
          }

          // Initialize Firebase collections for this user
          await initFirebaseCollections(user.uid);

          // Fetch user data from Firestore
          const userDoc = await getDoc(doc(db, "users", user.uid));

          // Admin status is read from Firestore only. It is granted by an
          // existing admin or in the Firebase console, never by email address.
          if (userDoc.exists()) {
            setUserData(userDoc.data() as UserData);
          }
        } else {
          setUserData(null);
        }

        setLoading(false);
        if (initializing) {
          setInitializing(false);
        }
      });

      return unsubscribe;
    };

    initializeApp();
  }, []);

  const signup = async (email: string, password: string) => {
    try {
      console.log("Starting signup process for:", email);
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;
      console.log("User created successfully in Firebase Auth:", user.uid);

      // Create user document in Firestore with more complete data
      const userData = {
        email: user.email,
        isAdmin: false,
        createdAt: new Date().toISOString(),
        preferredCurrency: "TND", // Default to Tunisian Dinar
        displayName: user.displayName || null,
        photoURL: user.photoURL || null,
        subscription: {
          plan: "free",
          triesRemaining: 3,
          lastReset: new Date().toISOString(),
          exploredCountries: [],
          favorites: []
        }
      };

      // First check if the document already exists
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (!userDocSnap.exists()) {
        console.log("Creating new user document in Firestore:", user.uid);
        await setDoc(userDocRef, userData);
        console.log("User document created successfully");
      } else {
        console.log("User document already exists, not overwriting");
      }

      return user;
    } catch (error: any) {
      console.error("Error in signup process:", error.code, error.message);
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      console.log("Attempting login for:", email);
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;
      console.log("Login successful for:", user.uid);
      
      // Update lastLogin timestamp in Firestore
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          // Update existing user doc with login timestamp
          await updateDoc(userDocRef, {
            lastLogin: new Date().toISOString()
          });
          console.log("Updated lastLogin timestamp");
        } else {
          // User doc doesn't exist in Firestore, create it
          console.log("User document not found in Firestore, creating one");
          await setDoc(userDocRef, {
            email: user.email,
            isAdmin: false,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            preferredCurrency: "TND",
            displayName: user.displayName || null,
            photoURL: user.photoURL || null,
            subscription: {
              plan: "free",
              triesRemaining: 3,
              lastReset: new Date().toISOString(),
              exploredCountries: [],
              favorites: []
            }
          });
          console.log("Created missing user document");
        }
      } catch (firestoreError) {
        console.error("Error updating Firestore after login:", firestoreError);
        // Continue with login even if Firestore update fails
      }
      
      return user;
    } catch (error: any) {
      console.error("Login error:", error.code, error.message);
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const updateUserData = async (data: Partial<UserData>) => {
    try {
      if (!user) throw new Error("No user logged in");
      
      await updateDoc(doc(db, "users", user.uid), data);
      setUserData(prev => prev ? { ...prev, ...data } : null);
    } catch (error) {
      console.error("Error updating user data:", error);
      throw error;
    }
  };

  // Add Google Authentication
  const loginWithGoogle = async (idToken: string) => {
    try {
      console.log("Attempting Google login with ID token");
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      const user = userCredential.user;
      console.log("Google login successful for:", user.uid);
      
      // Check if user document exists in Firestore
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        // Update existing user document with login timestamp
        await updateDoc(userDocRef, {
          lastLogin: new Date().toISOString(),
          photoURL: user.photoURL || null
        });
        console.log("Updated user document after Google login");
      } else {
        // Create new user document
        console.log("Creating new user document after Google login");
        await setDoc(userDocRef, {
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          isAdmin: false,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          preferredCurrency: "TND",
          subscription: {
            plan: "free",
            triesRemaining: 3,
            lastReset: new Date().toISOString(),
            exploredCountries: [],
            favorites: []
          }
        });
      }
      
      return user;
    } catch (error: any) {
      console.error("Error in Google login:", error.code, error.message);
      throw error;
    }
  };

  const value = {
    user,
    userData,
    loading,
    initializing,
    signup,
    login,
    loginWithGoogle,
    logout,
    updateUserData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
