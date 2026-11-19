interface CulturalInsight {
  id: string;
  title: string;
  description: string;
  category:
    | "history"
    | "tradition"
    | "etiquette"
    | "ingredients"
    | "preparation";
  country: string;
  relatedDishes?: string[];
  source?: string;
}

// Sample cultural insights data
const CULTURAL_INSIGHTS: CulturalInsight[] = [
  {
    id: "tunisian-spices",
    title: "The Art of Tunisian Spices",
    description:
      "Tunisian cuisine is known for its unique blend of spices, including harissa, tabil, and caraway. These spices not only add flavor but also have traditional medicinal properties.",
    category: "ingredients",
    country: "Tunisian",
    relatedDishes: ["couscous", "shakshuka"],
  },
  {
    id: "tunisian-hospitality",
    title: "Tunisian Dining Etiquette",
    description:
      "In Tunisia, meals are social events where families gather to share food and conversation. It's customary to eat with your right hand and to always accept a second serving as a sign of appreciation.",
    category: "etiquette",
    country: "Tunisian",
  },
  {
    id: "couscous-history",
    title: "The History of Couscous",
    description:
      "Couscous, Tunisia's national dish, dates back to the 13th century. Originally made by hand-rolling semolina flour with water, it was traditionally prepared by women who would gather to make large batches together.",
    category: "history",
    country: "Tunisian",
    relatedDishes: ["couscous"],
  },
  {
    id: "ramadan-traditions",
    title: "Ramadan Food Traditions",
    description:
      "During Ramadan, Tunisian families break their fast with dates and a bowl of shorba, a hearty soup. Special pastries like zlebia are prepared only during this holy month.",
    category: "tradition",
    country: "Tunisian",
  },
  {
    id: "bread-culture",
    title: "The Importance of Bread",
    description:
      "Bread is sacred in Tunisian culture. Traditional khobz bread is used to scoop up food, and it's considered disrespectful to throw away bread. Leftover bread is often given to animals.",
    category: "tradition",
    country: "Tunisian",
  },
];

class CulturalInsightsService {
  getInsightsByCountry(country: string): CulturalInsight[] {
    if (!country) return [];
    return CULTURAL_INSIGHTS.filter((insight) => insight.country === country);
  }

  getInsightsByDish(dishId: string): CulturalInsight[] {
    if (!dishId) return [];
    return CULTURAL_INSIGHTS.filter((insight) =>
      insight.relatedDishes?.includes(dishId.toLowerCase())
    );
  }

  getRandomInsight(country: string): CulturalInsight | null {
    if (!country) return null;
    const countryInsights = this.getInsightsByCountry(country);
    if (countryInsights.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * countryInsights.length);
    return countryInsights[randomIndex];
  }

  getCategoryIcon(category: CulturalInsight["category"]): string {
    switch (category) {
      case "history":
        return "📚";
      case "tradition":
        return "🎭";
      case "etiquette":
        return "🍽️";
      case "ingredients":
        return "🌶️";
      case "preparation":
        return "👩‍🍳";
      default:
        return "💡";
    }
  }

  getCategoryTitle(category: CulturalInsight["category"]): string {
    switch (category) {
      case "history":
        return "Historical Background";
      case "tradition":
        return "Cultural Tradition";
      case "etiquette":
        return "Dining Etiquette";
      case "ingredients":
        return "Ingredients & Spices";
      case "preparation":
        return "Traditional Preparation";
      default:
        return "Cultural Insight";
    }
  }
}

export const culturalInsightsService = new CulturalInsightsService();
export type { CulturalInsight };
