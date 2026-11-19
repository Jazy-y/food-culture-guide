import { db } from "../config/firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  requirement: number;
  type: "countries" | "dishes" | "favorites" | "special";
}

export interface UserAchievements {
  unlockedAchievements: string[];
  progress: {
    countriesExplored: number;
    dishesViewed: number;
    favoritesSaved: number;
  };
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "world_explorer_1",
    title: "Culinary Tourist",
    description: "Explore 3 different countries",
    icon: "🌍",
    requirement: 3,
    type: "countries",
  },
  {
    id: "world_explorer_2",
    title: "Globe Trotter",
    description: "Explore 10 different countries",
    icon: "🌎",
    requirement: 10,
    type: "countries",
  },
  {
    id: "world_explorer_3",
    title: "World Connoisseur",
    description: "Explore 20 different countries",
    icon: "🌏",
    requirement: 20,
    type: "countries",
  },
  {
    id: "dish_master_1",
    title: "Food Enthusiast",
    description: "View 10 different dishes",
    icon: "🍽️",
    requirement: 10,
    type: "dishes",
  },
  {
    id: "dish_master_2",
    title: "Gourmet Explorer",
    description: "View 50 different dishes",
    icon: "👨‍🍳",
    requirement: 50,
    type: "dishes",
  },
  {
    id: "favorites_1",
    title: "Flavor Collector",
    description: "Save 5 dishes to favorites",
    icon: "❤️",
    requirement: 5,
    type: "favorites",
  },
  {
    id: "favorites_2",
    title: "Taste Curator",
    description: "Save 20 dishes to favorites",
    icon: "💝",
    requirement: 20,
    type: "favorites",
  },
  {
    id: "premium_member",
    title: "Premium Foodie",
    description: "Upgrade to Premium membership",
    icon: "👑",
    requirement: 1,
    type: "special",
  },
];

const STORAGE_KEY = "user_achievements";

class AchievementService {
  private getUserRef(userId: string) {
    return doc(db, "users", userId);
  }

  private async saveToLocalStorage(
    userId: string,
    achievements: UserAchievements | null
  ) {
    try {
      if (achievements === null || achievements === undefined) {
        await AsyncStorage.removeItem(`${STORAGE_KEY}_${userId}`);
        return;
      }
      await AsyncStorage.setItem(
        `${STORAGE_KEY}_${userId}`,
        JSON.stringify(achievements)
      );
    } catch (error) {
      console.warn("Failed to save achievements to local storage:", error);
    }
  }

  private async getFromLocalStorage(
    userId: string
  ): Promise<UserAchievements | null> {
    try {
      const data = await AsyncStorage.getItem(`${STORAGE_KEY}_${userId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn("Failed to get achievements from local storage:", error);
      return null;
    }
  }

  async initializeAchievements(userId: string): Promise<void> {
    const achievements: UserAchievements = {
      unlockedAchievements: [],
      progress: {
        countriesExplored: 0,
        dishesViewed: 0,
        favoritesSaved: 0,
      },
    };

    try {
      await setDoc(this.getUserRef(userId), { achievements }, { merge: true });
    } catch (error) {
      console.warn("Failed to initialize achievements in Firestore:", error);
    }

    this.saveToLocalStorage(userId, achievements);
  }

  async getUserAchievements(userId: string): Promise<UserAchievements | null> {
    try {
      const userDoc = await getDoc(this.getUserRef(userId));
      if (!userDoc.exists()) {
        return null;
      }
      const achievements = userDoc.data().achievements as UserAchievements;
      if (achievements) {
        this.saveToLocalStorage(userId, achievements);
      }
      return achievements;
    } catch (error) {
      console.warn("Failed to get achievements from Firestore:", error);
      // Try to get from local storage
      return this.getFromLocalStorage(userId);
    }
  }

  async checkAndUpdateAchievements(userId: string): Promise<string[]> {
    let userAchievements = await this.getUserAchievements(userId);
    if (!userAchievements) {
      await this.initializeAchievements(userId);
      userAchievements = await this.getUserAchievements(userId);
      if (!userAchievements) return [];
    }

    try {
      const userDoc = await getDoc(this.getUserRef(userId));
      if (!userDoc.exists()) return [];

      const userData = userDoc.data();
      const newAchievements: string[] = [];

      // Check country exploration achievements
      const countriesCount =
        userData?.subscription?.exploredCountries?.length || 0;
      ACHIEVEMENTS.filter(
        (a) => a.type === "countries" && a.requirement <= countriesCount
      ).forEach((achievement) => {
        if (!userAchievements?.unlockedAchievements.includes(achievement.id)) {
          newAchievements.push(achievement.id);
        }
      });

      // Check favorites achievements
      const favoritesCount = userData?.subscription?.favorites?.length || 0;
      ACHIEVEMENTS.filter(
        (a) => a.type === "favorites" && a.requirement <= favoritesCount
      ).forEach((achievement) => {
        if (!userAchievements?.unlockedAchievements.includes(achievement.id)) {
          newAchievements.push(achievement.id);
        }
      });

      // Check premium achievement
      if (userData?.subscription?.plan === "premium") {
        const premiumAchievement = ACHIEVEMENTS.find(
          (a) => a.id === "premium_member"
        );
        if (
          premiumAchievement &&
          !userAchievements.unlockedAchievements.includes(premiumAchievement.id)
        ) {
          newAchievements.push(premiumAchievement.id);
        }
      }

      // Update achievements if new ones were unlocked
      if (newAchievements.length > 0) {
        const updatedAchievements = {
          ...userAchievements,
          unlockedAchievements: [
            ...userAchievements.unlockedAchievements,
            ...newAchievements,
          ],
        };

        try {
          await updateDoc(this.getUserRef(userId), {
            "achievements.unlockedAchievements":
              updatedAchievements.unlockedAchievements,
          });
        } catch (error) {
          console.warn("Failed to update achievements in Firestore:", error);
        }

        this.saveToLocalStorage(userId, updatedAchievements);
      }

      return newAchievements;
    } catch (error) {
      console.warn("Error checking achievements:", error);
      return [];
    }
  }

  getAchievementDetails(achievementId: string): Achievement | undefined {
    return ACHIEVEMENTS.find((a) => a.id === achievementId);
  }

  calculateProgress(
    achievement: Achievement,
    userAchievements: UserAchievements
  ): number {
    switch (achievement.type) {
      case "countries":
        return Math.min(
          100,
          (userAchievements.progress.countriesExplored /
            achievement.requirement) *
            100
        );
      case "dishes":
        return Math.min(
          100,
          (userAchievements.progress.dishesViewed / achievement.requirement) *
            100
        );
      case "favorites":
        return Math.min(
          100,
          (userAchievements.progress.favoritesSaved / achievement.requirement) *
            100
        );
      case "special":
        return userAchievements.unlockedAchievements.includes(achievement.id)
          ? 100
          : 0;
      default:
        return 0;
    }
  }
}

export const achievementService = new AchievementService();
