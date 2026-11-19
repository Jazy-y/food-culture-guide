// Register the App component immediately at the start
import { AppRegistry } from 'react-native';

// Preemptively register the main component
// This creates a circular reference but works better than other approaches for React Native
if (!AppRegistry.getAppKeys().includes('main')) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  AppRegistry.registerComponent('main', () => require('./App').default);
}

import "react-native-gesture-handler";
import "react-native-reanimated";
import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider } from "./src/theme";
import SplashScreen from "./src/screens/SplashScreen";
import { createNavigationStack } from "./src/App";
import { AuthProvider, useAuth } from "./src/contexts/AuthContext";
import { LogBox } from 'react-native';
import { analyticsService } from "./src/services/analytics-service";

// Suppress specific warnings that are safe to ignore
LogBox.ignoreLogs([
  "URL.createObjectURL",
  "Cannot create URL for blob!",
  "Invariant Violation: \"main\" has not been registered"
]);

// Listen for unhandled promise rejections to catch and log Firebase errors
if (__DEV__) {
  const originalConsoleError = console.error;
  console.error = (...args) => {
    // Look for Firebase-related errors in console.error calls
    const errorText = args.join(' ');
    if (errorText.includes('Firebase') || errorText.includes('firestore')) {
      console.log('--------- FIREBASE ERROR DETECTED ---------');
      console.log('Error details:', args);
      console.log('------------------------------------------');
    }
    
    originalConsoleError(...args);
  };
}

// Main App component
const App = () => {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Show splash screen for minimum of 2 seconds
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);

    // Initialize analytics service
    const initAnalytics = async () => {
      try {
        await analyticsService.initialize();
        console.log("Analytics service initialized successfully");
      } catch (error) {
        console.error("Failed to initialize analytics service:", error);
      }
    };

    initAnalytics();

    return () => {
      clearTimeout(timer);
      analyticsService.dispose(); // Clean up analytics when app unmounts
    };
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppContent showSplash={showSplash} />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

// Separate component to use the Auth context
function AppContent({ showSplash }: { showSplash: boolean }) {
  const { user, initializing } = useAuth();

  return (
    <NavigationContainer>
      {showSplash ? (
        <SplashScreen />
      ) : (
        createNavigationStack(user, initializing)
      )}
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}

export default App;
