import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "RestaurantDetails">;

const RestaurantDetailsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { restaurant } = route.params;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.imageContainer}>
        <Image
          source={{
            uri: restaurant.photoUrl || "https://via.placeholder.com/400x300",
          }}
          style={styles.image}
          resizeMode="cover"
        />
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.contentContainer}>
        <Text style={styles.title}>{restaurant.name}</Text>

        <View style={styles.ratingContainer}>
          <Ionicons name="star" size={20} color="#FFD700" />
          <Text style={styles.rating}>{restaurant.rating}</Text>
        </View>

        <View style={styles.infoContainer}>
          <View style={styles.infoRow}>
            <Ionicons name="location" size={20} color="#666" />
            <Text style={styles.infoText}>{restaurant.address}</Text>
          </View>

          {restaurant.distance && (
            <View style={styles.infoRow}>
              <Ionicons name="navigate" size={20} color="#666" />
              <Text style={styles.infoText}>{restaurant.distance}</Text>
            </View>
          )}

          {restaurant.priceLevel && (
            <View style={styles.infoRow}>
              <Ionicons name="pricetag" size={20} color="#666" />
              <Text style={styles.infoText}>
                {"$".repeat(restaurant.priceLevel)}
              </Text>
            </View>
          )}
        </View>

        {restaurant.openingHours && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Opening Hours</Text>
            {restaurant.openingHours.weekday_text?.map((day, index) => (
              <Text key={index} style={styles.openingHoursText}>
                {day}
              </Text>
            ))}
          </View>
        )}

        {restaurant.types && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cuisine Types</Text>
            <View style={styles.typesContainer}>
              {restaurant.types.map((type, index) => (
                <View key={index} style={styles.typeChip}>
                  <Text style={styles.typeText}>{type}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  imageContainer: {
    position: "relative",
    height: 250,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  backButton: {
    position: "absolute",
    top: 40,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  contentContainer: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  rating: {
    marginLeft: 5,
    fontSize: 18,
    color: "#333",
    fontWeight: "500",
  },
  infoContainer: {
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  infoText: {
    marginLeft: 10,
    fontSize: 16,
    color: "#666",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  openingHoursText: {
    fontSize: 16,
    color: "#666",
    marginBottom: 5,
  },
  typesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  typeChip: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  typeText: {
    fontSize: 14,
    color: "#666",
  },
});

export default RestaurantDetailsScreen;
