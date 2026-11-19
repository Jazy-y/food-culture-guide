import React, { useEffect } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const SplashScreen = () => {
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // The navigation is now handled by App.tsx
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Ionicons name="restaurant" size={80} color="#FF6B6B" />
        <Animated.Text style={[styles.title, { opacity: fadeAnim }]}>
          Food Culture Guide
        </Animated.Text>
        <Animated.Text style={[styles.subtitle, { opacity: fadeAnim }]}>
          Discover • Translate • Explore
        </Animated.Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginTop: 20,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 10,
    textAlign: "center",
  },
});

export default SplashScreen;
