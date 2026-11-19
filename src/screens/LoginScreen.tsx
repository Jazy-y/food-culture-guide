import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { Button, TextInput } from "../components/common";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';

// Important: Register for Google web callback
WebBrowser.maybeCompleteAuthSession();

// Add your Google Client ID here - you'll need to create one in Google Cloud Console
const GOOGLE_CLIENT_ID = Constants.expoConfig?.extra?.GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID_HERE";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login, loginWithGoogle } = useAuth();

  // Set up Google Auth request - fixed property names for compatibility
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    iosClientId: GOOGLE_CLIENT_ID,
    androidClientId: GOOGLE_CLIENT_ID,
    webClientId: GOOGLE_CLIENT_ID,
  });

  // Handle Google Auth response
  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      handleGoogleLogin(id_token);
    }
  }, [response]);

  const handleGoogleLogin = async (idToken: string) => {
    try {
      setGoogleLoading(true);
      await loginWithGoogle(idToken);
      // Navigation will be handled automatically by auth state listener
    } catch (error: any) {
      console.error("Google login error:", error);
      Alert.alert("Login Failed", "Failed to login with Google. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const user = await login(email, password);
      console.log("Login successful:", user.uid);
      // Navigation will be handled automatically by the auth state listener in App.tsx
    } catch (error: any) {
      console.error("Login error:", error);
      let errorMessage = "Login failed. Please try again.";

      switch (error.code) {
        case "auth/invalid-email":
          errorMessage = "Please enter a valid email address.";
          break;
        case "auth/user-disabled":
          errorMessage = "This account has been disabled.";
          break;
        case "auth/user-not-found":
          errorMessage = "No account found with this email.";
          break;
        case "auth/wrong-password":
          errorMessage = "Incorrect password.";
          break;
        case "auth/network-request-failed":
          errorMessage =
            "Network error. Please check your internet connection.";
          break;
        case "auth/too-many-requests":
          errorMessage = "Too many failed attempts. Please try again later.";
          break;
      }

      Alert.alert("Login Failed", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={24} color="#333" />
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Welcome Back!</Text>
        <Text style={styles.subtitle}>
          Sign in to continue exploring food cultures
        </Text>

        <View style={styles.form}>
          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon="mail-outline"
            editable={!loading}
          />

          <TextInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            leftIcon="lock-closed-outline"
            editable={!loading}
          />

          <TouchableOpacity
            style={styles.forgotPassword}
            onPress={() =>
              Alert.alert("Coming Soon", "Password reset feature coming soon!")
            }
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          <Button
            title={loading ? "Logging in..." : "Login"}
            onPress={handleLogin}
            loading={loading}
            style={styles.loginButton}
            disabled={loading || googleLoading}
          />

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity
            style={styles.googleButton}
            onPress={() => promptAsync()}
            disabled={loading || googleLoading || !request}
          >
            {googleLoading ? (
              <ActivityIndicator size="small" color="#444" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#444" style={styles.googleIcon} />
                <Text style={styles.googleButtonText}>Sign in with Google</Text>
              </>
            )}
          </TouchableOpacity>

        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don&apos;t have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Register")}>
            <Text style={styles.signUpText}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  backButton: {
    position: "absolute",
    top: 40,
    left: 20,
    zIndex: 1,
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 100,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 40,
  },
  form: {
    gap: 16,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginTop: -8,
    marginBottom: 16,
  },
  forgotPasswordText: {
    color: "#FF6B35",
    fontSize: 14,
  },
  loginButton: {
    marginTop: 8,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    color: '#888',
    paddingHorizontal: 10,
    fontSize: 14,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  googleButtonText: {
    color: '#444',
    fontSize: 16,
    fontWeight: '500',
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 40,
  },
  footerText: {
    color: "#666",
    fontSize: 14,
  },
  signUpText: {
    color: "#FF6B35",
    fontSize: 14,
    fontWeight: "bold",
  },
});

export default LoginScreen;
