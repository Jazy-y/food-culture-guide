import React from "react";
import { View, StyleSheet, Image } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { Button } from "../components/common";

type Props = NativeStackScreenProps<RootStackParamList, "Welcome">;

const WelcomeScreen = ({ navigation }: Props) => {
  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Image
          source={require("../assets/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <View style={styles.iconContainer}>
        {/* Temporary clock icon representation */}
        <View style={styles.clockIcon}>
          <View style={styles.clockCircle}>
            <View style={styles.clockHand} />
            <View style={[styles.clockHand, styles.clockMinute]} />
          </View>
        </View>

        <View style={styles.decorations}>
          <View style={[styles.decoration, styles.circle]} />
          <View style={[styles.decoration, styles.line]} />
          <View style={[styles.decoration, styles.triangle]} />
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <Button
          title="Login"
          onPress={() => navigation.navigate("Login")}
          style={styles.loginButton}
          textStyle={styles.loginButtonText}
        />
        <Button
          title="Register Now"
          onPress={() => navigation.navigate("Register")}
          style={styles.registerButton}
          textStyle={styles.registerButtonText}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FF6B6B",
    padding: 20,
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 60,
  },
  logo: {
    width: 120,
    height: 60,
    tintColor: "#FFFFFF",
  },
  iconContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  clockIcon: {
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  clockCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  clockHand: {
    position: "absolute",
    width: 4,
    height: 30,
    backgroundColor: "#FFFFFF",
    top: 10,
    left: "50%",
    marginLeft: -2,
    borderRadius: 2,
    transformOrigin: "bottom",
    transform: [{ rotate: "45deg" }],
  },
  clockMinute: {
    height: 20,
    transform: [{ rotate: "90deg" }],
  },
  decorations: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  decoration: {
    position: "absolute",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  circle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    top: "30%",
    left: "20%",
  },
  line: {
    width: 30,
    height: 4,
    top: "50%",
    right: "20%",
    transform: [{ rotate: "45deg" }],
  },
  triangle: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 15,
    borderRightWidth: 15,
    borderBottomWidth: 25,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "rgba(255, 255, 255, 0.2)",
    bottom: "30%",
    right: "30%",
  },
  buttonContainer: {
    marginBottom: 40,
  },
  loginButton: {
    backgroundColor: "#FFFFFF",
    marginBottom: 15,
    height: 50,
    borderRadius: 25,
  },
  loginButtonText: {
    color: "#FF6B6B",
    fontSize: 16,
    fontWeight: "600",
  },
  registerButton: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#FFFFFF",
    height: 50,
    borderRadius: 25,
  },
  registerButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default WelcomeScreen;
