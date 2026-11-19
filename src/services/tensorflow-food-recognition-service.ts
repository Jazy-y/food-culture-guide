/**
 * Mock TensorFlow Food Recognition Service
 * This is a simplified version that doesn't depend on TensorFlow
 */

interface FoodRecognitionResult {
  success: boolean;
  errorMessage?: string;
  name: string;
  description?: string;
  ingredients?: string[];
  culturalInfo?: string;
  confidence: number;
  otherOptions?: Array<{name: string, confidence: number}>;
}

class TensorFlowFoodRecognitionService {
  private static isInitialized = false;
  private static foodDatabase: any[] = [
    {
      keywords: ["pizza", "italian", "cheese", "tomato"],
      name: "Pizza",
      description: "A savory dish consisting of a round, flattened base of dough topped with various ingredients.",
      ingredients: ["Dough", "Tomato sauce", "Cheese", "Toppings (various)"],
      culturalInfo: "Pizza originated in Italy and has become one of the most popular foods worldwide.",
    },
    {
      keywords: ["burger", "hamburger", "cheeseburger", "beef", "patty", "bun"],
      name: "Burger",
      description: "A sandwich consisting of a cooked patty of ground meat, typically placed inside a sliced bun.",
      ingredients: ["Beef patty", "Bun", "Lettuce", "Tomato", "Onion", "Cheese", "Condiments"],
      culturalInfo: "The hamburger originated in Germany but was popularized in the United States.",
    },
    {
      keywords: ["sushi", "japanese", "roll", "maki", "nigiri", "raw", "fish", "rice"],
      name: "Sushi",
      description: "A Japanese dish consisting of prepared vinegared rice accompanied by various ingredients.",
      ingredients: ["Rice", "Vinegar", "Nori (seaweed)", "Fish (various)", "Vegetables"],
      culturalInfo: "Sushi originated in Southeast Asia but was developed into its current form in Japan.",
    },
    {
      keywords: ["pasta", "spaghetti", "italian", "noodle"],
      name: "Pasta",
      description: "An Italian dish made of wheat flour and water, formed into various shapes and cooked.",
      ingredients: ["Wheat flour", "Water", "Sauce (various)"],
      culturalInfo: "Pasta has its roots in Italy and has become a staple food in many cultures worldwide.",
    },
    {
      keywords: ["taco", "mexican", "tortilla", "beef", "salsa"],
      name: "Tacos",
      description: "A traditional Mexican dish consisting of a small hand-sized corn or wheat tortilla topped with a filling.",
      ingredients: ["Tortilla", "Meat (beef, chicken, or pork)", "Onions", "Cilantro", "Salsa", "Lime"],
      culturalInfo: "Tacos date back to the 18th century in Mexico and are now popular globally.",
    }
  ];

  // Initialize and load labels
  static async initialize(): Promise<boolean> {
    console.log('Mock TensorFlow Food Recognition Service initialized');
    this.isInitialized = true;
    return true;
  }

  // Recognize food from an image URI
  static async recognizeFood(imageUri: string, foodHint?: string | null): Promise<FoodRecognitionResult> {
    console.log('Mock recognizing food:', imageUri, foodHint);
    
    // If we have a food hint, use that
    if (foodHint) {
      const foodDetails = this.getFoodDetailsFromDatabase(foodHint);
      const confidence = 0.9; // High confidence for hint
      
      return {
        success: true,
        name: foodHint,
        description: foodDetails.description,
        ingredients: foodDetails.ingredients,
        culturalInfo: foodDetails.culturalInfo,
        confidence: confidence,
        otherOptions: this.generateAlternatives(foodHint, confidence)
      };
    }
    
    // Otherwise use image name to try to identify food
    const imageName = imageUri.split('/').pop()?.toLowerCase() || '';
    
    // Look for keywords in the filename
    let bestMatch: { name: string; description: string; ingredients: string[]; culturalInfo: string } | null = null;
    let bestMatchScore = 0;
    
    for (const food of this.foodDatabase) {
      for (const keyword of food.keywords) {
        if (imageName.includes(keyword)) {
          const score = keyword.length / imageName.length; // Simple scoring
          if (score > bestMatchScore) {
            bestMatch = food;
            bestMatchScore = score;
          }
        }
      }
    }
    
    // If we found a match, return it
    if (bestMatch) {
      const confidence = 0.7 + (bestMatchScore * 0.3); // Between 0.7 and 1.0
      
      return {
        success: true,
        name: bestMatch.name,
        description: bestMatch.description,
        ingredients: bestMatch.ingredients,
        culturalInfo: bestMatch.culturalInfo,
        confidence: confidence,
        otherOptions: this.generateAlternatives(bestMatch.name, confidence)
      };
    }
    
    // Fallback to random food
    const randomIndex = Math.floor(Math.random() * this.foodDatabase.length);
    const randomFood = this.foodDatabase[randomIndex];
    const confidence = 0.6; // Lower confidence for random
    
    return {
      success: true,
      name: randomFood.name,
      description: randomFood.description,
      ingredients: randomFood.ingredients,
      culturalInfo: randomFood.culturalInfo,
      confidence: confidence,
      otherOptions: this.generateAlternatives(randomFood.name, confidence)
    };
  }
  
  // Generate alternative food options
  private static generateAlternatives(mainFood: string, mainConfidence: number): Array<{name: string, confidence: number}> {
    const alternatives: Array<{name: string, confidence: number}> = [];
    const usedNames = new Set<string>([mainFood]);
    
    // Generate 4 alternative options
    while (alternatives.length < 4 && alternatives.length < this.foodDatabase.length - 1) {
      // Get a random food
      const randIndex = Math.floor(Math.random() * this.foodDatabase.length);
      const foodName = this.foodDatabase[randIndex].name;
      
      if (!usedNames.has(foodName)) {
        usedNames.add(foodName);
        
        // Add with decreasing confidence
        alternatives.push({
          name: foodName,
          confidence: Math.max(0.1, mainConfidence - (0.15 * (alternatives.length + 1)))
        });
      }
    }
    
    return alternatives;
  }
  
  // Get food details from the database
  private static getFoodDetailsFromDatabase(foodName: string): any {
    // Find matching food in database
    const normalizedName = foodName.toLowerCase();
    
    // Try to find exact match
    const exactMatch = this.foodDatabase.find(
      food => food.name.toLowerCase() === normalizedName
    );
    
    if (exactMatch) {
      return exactMatch;
    }
    
    // Try to find by keywords
    const keywordMatch = this.foodDatabase.find(
      food => food.keywords.some(keyword => normalizedName.includes(keyword))
    );
    
    if (keywordMatch) {
      return keywordMatch;
    }
    
    // Return generic food details if no match found
    return {
      name: foodName,
      description: `A delicious ${foodName} dish.`,
      ingredients: ["Various ingredients based on recipe"],
      culturalInfo: `${foodName} is a popular dish enjoyed in many cultures around the world.`
    };
  }
}

export default TensorFlowFoodRecognitionService; 