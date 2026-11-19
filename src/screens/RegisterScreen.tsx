import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Modal,
} from "react-native";
import { Button, TextInput } from "../components/common";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { updateProfile } from "firebase/auth";
import { useAuth } from "../contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from '@react-native-community/datetimepicker';
import { doc, setDoc } from "firebase/firestore";
import { db } from "../config/firebase";

type Props = NativeStackScreenProps<RootStackParamList, "Register">;

const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState<string>("");
  const [birthdate, setBirthdate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setBirthdate(selectedDate);
    }
  };

  const selectGender = (selected: string) => {
    setGender(selected);
    setShowGenderModal(false);
  };

  // Helper function to calculate age from birthdate
  const calculateAge = (birthdate: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - birthdate.getFullYear();
    const m = today.getMonth() - birthdate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthdate.getDate())) {
      age--;
    }
    return age;
  };

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }
    if (!gender) {
      Alert.alert("Error", "Please select your gender");
      return;
    }
    if (!birthdate) {
      Alert.alert("Error", "Please select your birthdate");
      return;
    }
    if (!termsAccepted) {
      Alert.alert("Error", "Please accept the Terms & Conditions");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password should be at least 6 characters long");
      return;
    }

    try {
      setLoading(true);
      // Create user using the signup function from useAuth
      const user = await signup(email, password);

      // Update user profile with name
      await updateProfile(user, {
        displayName: name,
      });

      // Add additional user data to Firestore
      await setDoc(doc(db, "users", user.uid), {
        displayName: name,
        email: email,
        profile: {
          gender: gender ? gender.toLowerCase() : null,
          age: birthdate ? calculateAge(birthdate) : null,
          location: null // Can be updated later in profile settings
        },
        createdAt: new Date().toISOString(),
        isAdmin: false,
      }, { merge: true });

      // Navigate directly to the main app
      navigation.replace("Main");
      
    } catch (error: any) {
      console.error("Registration error:", error);
      let errorMessage = "Registration failed";
      let errorTitle = "Error";

      switch (error.code) {
        case "auth/email-already-in-use":
          errorMessage =
            "This email is already registered. Please try logging in instead.";
          break;
        case "auth/invalid-email":
          errorMessage = "Please enter a valid email address.";
          break;
        case "auth/operation-not-allowed":
          errorTitle = "Service Not Available";
          errorMessage =
            "Email/Password registration is currently not enabled. Please try again later or contact support.";
          break;
        case "auth/weak-password":
          errorMessage = "Password should be at least 6 characters long.";
          break;
        case "auth/network-request-failed":
          errorMessage =
            "Network error. Please check your internet connection and try again.";
          break;
        default:
          errorMessage = "Registration failed. Please try again later.";
      }

      Alert.alert(errorTitle, errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.contentContainer}>
          <View style={styles.headerContainer}>
            <Image
              source={require("../assets/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Create Account</Text>
          </View>

          <View style={styles.formContainer}>
            <TextInput
              placeholder="Full Name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              leftIcon="person-outline"
              editable={!loading}
            />

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
            <Text style={styles.passwordHint}>
              Password must be at least 6 characters
            </Text>

            {/* Gender Selection */}
            <TouchableOpacity 
              style={styles.pickerButton}
              onPress={() => setShowGenderModal(true)}
              disabled={loading}
            >
              <Ionicons name="body-outline" size={22} color="#666" style={styles.pickerIcon} />
              <Text style={[styles.pickerText, gender ? styles.pickerTextSelected : {}]}>
                {gender || "Select Gender (Required)"}
              </Text>
              <Ionicons name="chevron-down" size={22} color="#666" />
            </TouchableOpacity>

            {/* Birthdate Selection */}
            <TouchableOpacity 
              style={styles.pickerButton}
              onPress={() => setShowDatePicker(true)}
              disabled={loading}
            >
              <Ionicons name="calendar-outline" size={22} color="#666" style={styles.pickerIcon} />
              <Text style={[styles.pickerText, birthdate ? styles.pickerTextSelected : {}]}>
                {birthdate ? formatDate(birthdate) : "Select Birthdate (Required)"}
              </Text>
              <Ionicons name="chevron-down" size={22} color="#666" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.termsContainer}
              onPress={() => !loading && setTermsAccepted(!termsAccepted)}
            >
              <View
                style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}
              >
                {termsAccepted && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.termsText}>
                I Read and agree to{" "}
                <Text style={styles.termsLink}>Terms & Conditions</Text>
              </Text>
            </TouchableOpacity>

            <Button
              title={loading ? "Creating Account..." : "Register Now"}
              onPress={handleRegister}
              style={styles.registerButton}
              disabled={loading}
            />

            <Text style={styles.orText}>Or Register using social Media</Text>

            <View style={styles.socialContainer}>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() =>
                  Alert.alert(
                    "Coming Soon",
                    "Social media registration will be available soon!"
                  )
                }
                disabled={loading}
              >
                <Text style={styles.socialButtonText}>f</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() =>
                  Alert.alert(
                    "Coming Soon",
                    "Social media registration will be available soon!"
                  )
                }
                disabled={loading}
              >
                <Text style={styles.socialButtonText}>t</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.loginLink}
              onPress={() => !loading && navigation.navigate("Login")}
            >
              <Text style={styles.loginText}>
                Already have an account?{" "}
                <Text style={styles.loginTextBold}>Login</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={birthdate || new Date(2000, 0, 1)}
          mode="date"
          display="default"
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      )}

      {/* Gender Selection Modal */}
      <Modal
        visible={showGenderModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowGenderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Gender</Text>
            
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => selectGender("Male")}
            >
              <Text style={styles.modalOptionText}>Male</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => selectGender("Female")}
            >
              <Text style={styles.modalOptionText}>Female</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalOption, styles.cancelOption]}
              onPress={() => setShowGenderModal(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContainer: {
    flexGrow: 1,
  },
  contentContainer: {
    flex: 1,
  },
  headerContainer: {
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 30,
    backgroundColor: "#fff",
  },
  logo: {
    width: 120,
    height: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  formContainer: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 30,
    gap: 16,
  },
  passwordHint: {
    fontSize: 12,
    color: "#666",
    marginTop: -12,
    marginBottom: 8,
  },
  termsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: "#999",
    borderRadius: 4,
    marginRight: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#FF6B35",
    borderColor: "#FF6B35",
  },
  checkmark: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  termsText: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  termsLink: {
    color: "#FF6B35",
    fontWeight: "bold",
  },
  registerButton: {
    marginTop: 10,
  },
  orText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    marginVertical: 15,
  },
  socialContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 15,
  },
  socialButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#eee",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  socialButtonText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#999",
  },
  loginLink: {
    alignSelf: "center",
    marginTop: 20,
    marginBottom: 10,
  },
  loginText: {
    fontSize: 14,
    color: "#333",
  },
  loginTextBold: {
    fontWeight: "bold",
    color: "#FF6B35",
  },
  // New styles for gender and birthdate
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 5,
  },
  pickerIcon: {
    marginRight: 10,
  },
  pickerText: {
    flex: 1,
    fontSize: 16,
    color: '#aaa',
  },
  pickerTextSelected: {
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalOption: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#333',
  },
  cancelOption: {
    borderBottomWidth: 0,
    marginTop: 5,
  },
  cancelText: {
    fontSize: 16,
    color: '#FF4757',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});

export default RegisterScreen;
