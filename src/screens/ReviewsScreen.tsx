import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { db, auth } from "../config/firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";

interface Review {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  timestamp: Date;
}

interface ReviewsScreenProps {
  route: {
    params: {
      foodName: string;
    };
  };
}

const ReviewsScreen: React.FC<ReviewsScreenProps> = ({ route }) => {
  const { foodName } = route.params;
  const [reviews, setReviews] = useState<Review[]>([]);
  const [newRating, setNewRating] = useState(0);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadReviews();
  }, [foodName]);

  const loadReviews = async () => {
    try {
      const reviewsQuery = query(
        collection(db, "reviews"),
        where("foodName", "==", foodName),
        orderBy("timestamp", "desc")
      );
      const querySnapshot = await getDocs(reviewsQuery);
      const loadedReviews = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp.toDate(),
      })) as Review[];
      setReviews(loadedReviews);
    } catch (error) {
      Alert.alert("Error", "Failed to load reviews");
    }
  };

  const handleSubmitReview = async () => {
    if (!auth.currentUser || newRating === 0) {
      Alert.alert("Error", "Please select a rating");
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "reviews"), {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || "Anonymous",
        foodName,
        rating: newRating,
        comment: newComment,
        timestamp: new Date(),
      });

      setNewRating(0);
      setNewComment("");
      await loadReviews();
      Alert.alert("Success", "Review submitted successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to submit review");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStars = (rating: number, interactive = false) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => interactive && setNewRating(star)}
            disabled={!interactive}
          >
            <Ionicons
              name={star <= rating ? "star" : "star-outline"}
              size={24}
              color="#FFD700"
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{foodName}</Text>
        <Text style={styles.subtitle}>Reviews & Ratings</Text>
      </View>

      <ScrollView style={styles.reviewsContainer}>
        {reviews.map((review) => (
          <View key={review.id} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Text style={styles.userName}>{review.userName}</Text>
              <Text style={styles.timestamp}>
                {review.timestamp.toLocaleDateString()}
              </Text>
            </View>
            {renderStars(review.rating)}
            {review.comment && (
              <Text style={styles.comment}>{review.comment}</Text>
            )}
          </View>
        ))}
      </ScrollView>

      {auth.currentUser && (
        <View style={styles.newReviewContainer}>
          <Text style={styles.newReviewTitle}>Write a Review</Text>
          {renderStars(newRating, true)}
          <TextInput
            style={styles.commentInput}
            placeholder="Share your experience..."
            value={newComment}
            onChangeText={setNewComment}
            multiline
            numberOfLines={3}
          />
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmitReview}
            disabled={isSubmitting || newRating === 0}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? "Submitting..." : "Submit Review"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: "#333",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 4,
  },
  reviewsContainer: {
    flex: 1,
    padding: 16,
  },
  reviewCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  timestamp: {
    fontSize: 12,
    color: "#666",
  },
  starsContainer: {
    flexDirection: "row",
    marginBottom: 8,
  },
  comment: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },
  newReviewContainer: {
    padding: 16,
    borderTopWidth: 0.5,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  newReviewTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  commentInput: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    marginBottom: 16,
    fontSize: 14,
    color: "#333",
    textAlignVertical: "top",
  },
  submitButton: {
    backgroundColor: "#FF6B6B",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default ReviewsScreen;
