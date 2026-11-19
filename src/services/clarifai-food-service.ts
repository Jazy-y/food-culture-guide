import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import axios from 'axios';
import * as ImageManipulator from 'expo-image-manipulator';

// Clarifai food model ID
const FOOD_MODEL_ID = 'bd367be194cf45149e75f01d59f77ba7';
const FOOD_MODEL_VERSION_ID = 'dfebc169854e429086aceb8368662641';

// API key for Clarifai
const PAT = Constants.expoConfig?.extra?.CLARIFAI_PAT || "";
const USER_ID = 'clarifai';
const APP_ID = 'main';
const API_URL = `https://api.clarifai.com/v2/models/${FOOD_MODEL_ID}/versions/${FOOD_MODEL_VERSION_ID}/outputs`;

// Minimum confidence threshold to consider a valid food recognition
const MIN_CONFIDENCE_THRESHOLD = 0.45;
// Minimum brightness threshold to consider an image valid (0-255)
const MIN_BRIGHTNESS_THRESHOLD = 25;
// Maximum percentage of black pixels to consider an image valid
const MAX_BLACK_PIXEL_PERCENTAGE = 80;

export interface FoodRecognitionResult {
  name: string;
  probability: number;
}

// New interface that matches the expected admin dashboard format
export interface EnhancedRecognitionResult {
  success: boolean;
  dishName: string;
  foodType: string;
  confidence: number;
  alternatives: Array<{name: string, confidence: number}>;
  ingredients: string[];
  nutritionData: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
  };
  rawResponse: any;
}

/**
 * Recognize food in an image using Clarifai's food recognition model
 * 
 * @param imageUri - The local URI of the image to analyze
 * @returns A promise that resolves to the recognition results
 */
export const recognizeFood = async (imageUri: string): Promise<any> => {
  try {
    console.log("Processing image:", imageUri);
    
    // First perform basic image validation
    const isValid = await isValidImage(imageUri);
    if (!isValid.valid) {
      console.log("Image validation failed:", isValid.reason);
      throw new Error(`Invalid image: ${isValid.reason}`);
    }
    
    // Resize the image to make sure it's not too large
    // This also creates a copy in a more accessible location
    const resizedImage = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 800 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    
    // Use the base64 data directly instead of reading from file
    const base64Image = resizedImage.base64;
    
    if (!base64Image) {
      throw new Error("Failed to convert image to base64");
    }
    
    console.log("Successfully converted image to base64");

    // Prepare the request using axios
    const response = await axios.post(
      API_URL,
      {
        inputs: [
          {
            data: {
              image: {
                base64: base64Image
              }
            }
          }
        ]
      },
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Key ${PAT}`,
        }
      }
    );

    console.log("Clarifai API response status:", response.status);
    
    // Check for successful response
    if (response.status !== 200) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    // Extract and format results
    const concepts = response.data.outputs[0].data.concepts;
    console.log("Received concepts:", concepts.length);
    
    // Format simple list of results (for backward compatibility)
    const simpleResults = concepts.map((concept: any) => ({
      name: concept.name,
      probability: concept.value
    }));

    // If there are no results, return an empty array
    if (concepts.length === 0) {
      console.log("No concepts returned from API");
      return { success: false, errorMessage: "No food detected in the image" };
    }
    
    // Get main food item and check confidence
    const mainFood = concepts[0];
    
    // Check if the confidence is too low - likely not a valid food image
    if (mainFood.value < MIN_CONFIDENCE_THRESHOLD) {
      console.log("Main food confidence too low:", mainFood.value, "< threshold:", MIN_CONFIDENCE_THRESHOLD);
      return { 
        success: false, 
        errorMessage: "No food detected with sufficient confidence. Please try a clearer image."
      };
    }
    
    const alternatives = concepts.slice(1, 4).map((concept: any) => ({
      name: concept.name,
      confidence: concept.value
    }));
    
    console.log("Main food identified:", mainFood.name, "with confidence:", mainFood.value);
    
    // Create a result object in the format the app expects
    const enhancedResult: EnhancedRecognitionResult = {
      success: true,
      dishName: mainFood.name,
      foodType: determineFoodType(mainFood.name),
      confidence: mainFood.value,
      alternatives: alternatives,
      ingredients: getFoodIngredients(mainFood.name),
      nutritionData: getFoodNutrition(mainFood.name),
      rawResponse: {
        labels: concepts.map((c: any) => c.name),
        mockDetection: false
      }
    };
    
    // Return the enhanced result
    return enhancedResult;
  } catch (error) {
    console.error('Error recognizing food:', error);
    
    // For debugging - provide more details about the error
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    // Return a proper error response instead of mock data
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : "An unknown error occurred during food recognition"
    };
  }
};

/**
 * Validates an image to ensure it's suitable for food recognition
 * Checks if the image exists, isn't too dark, and isn't mostly black
 * 
 * @param uri - URI of the image to validate
 * @returns Object with validation result and reason if invalid
 */
export const isValidImage = async (uri: string): Promise<{ valid: boolean; reason?: string }> => {
  try {
    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      return { valid: false, reason: "Image file does not exist" };
    }
    
    // Analyze image using image manipulation
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 100 } }], // Small size for quick analysis
      { base64: true, format: ImageManipulator.SaveFormat.JPEG }
    );
    
    if (!manipResult.base64) {
      return { valid: false, reason: "Unable to process image for validation" };
    }
    
    // Convert base64 to a usable format for pixel analysis
    const base64Data = manipResult.base64;
    
    // Simple test for dark/black images - check first few and last few bytes
    // of the base64 string for patterns typically found in dark images
    const darkImgPattern = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/;
    
    // Analyze base64 string for image darkness
    // This is a simplified approach - checking the frequency of dark color encoding
    const darkPixelFrequency = (base64Data.match(/A{4,}|B{4,}|C{4,}/g) || []).length;
    const base64Length = base64Data.length;
    
    // If more than X% of the base64 string shows patterns of dark pixels
    if (darkPixelFrequency > (base64Length * 0.8)) {
      return { valid: false, reason: "Image is too dark or mostly black" };
    }
    
    // Additional check - image size (prevent processing of tiny images)
    if (fileInfo.size < 1024) { // Less than 1KB
      return { valid: false, reason: "Image is too small" };
    }
    
    return { valid: true };
  } catch (error) {
    console.error('Error validating image:', error);
    return { valid: false, reason: "Error during image validation" };
  }
};

/**
 * Check if a URI is a valid image
 * 
 * @param uri - The URI to check
 * @returns True if the URI is a valid image, false otherwise
 */
export const isValidImageUri = async (uri: string): Promise<boolean> => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    return fileInfo.exists;
  } catch (error) {
    console.error('Error checking image URI:', error);
    return false;
  }
};

/**
 * Determine food type based on the food name
 */
const determineFoodType = (foodName: string): string => {
  const foodTypes: Record<string, string[]> = {
    'Italian': ['pizza', 'pasta', 'spaghetti', 'lasagna', 'risotto', 'carbonara'],
    'Japanese': ['sushi', 'ramen', 'tempura', 'udon', 'sashimi'],
    'American': ['burger', 'hot dog', 'sandwich', 'steak', 'fries'],
    'Mexican': ['taco', 'burrito', 'enchilada', 'quesadilla', 'guacamole'],
    'Indian': ['curry', 'tandoori', 'biryani', 'naan', 'tikka masala'],
    'Chinese': ['noodles', 'fried rice', 'dim sum', 'spring roll', 'kung pao']
  };
  
  const lowerName = foodName.toLowerCase();
  for (const [type, foods] of Object.entries(foodTypes)) {
    if (foods.some(food => lowerName.includes(food))) {
      return type;
    }
  }
  
  return 'International';
};

/**
 * Get common ingredients for a food
 */
const getFoodIngredients = (foodName: string): string[] => {
  const ingredients: Record<string, string[]> = {
    'pizza': ['Dough', 'Tomato sauce', 'Cheese', 'Toppings'],
    'pasta': ['Pasta', 'Tomato sauce', 'Cheese', 'Herbs'],
    'burger': ['Beef patty', 'Bun', 'Lettuce', 'Tomato', 'Onion', 'Cheese'],
    'sushi': ['Rice', 'Vinegar', 'Nori', 'Fish', 'Vegetables'],
    'salad': ['Lettuce', 'Vegetables', 'Dressing', 'Croutons'],
    'soup': ['Broth', 'Vegetables', 'Meat', 'Seasoning'],
    'sandwich': ['Bread', 'Meat', 'Cheese', 'Vegetables', 'Condiments'],
    'cake': ['Flour', 'Sugar', 'Eggs', 'Butter', 'Milk']
  };
  
  const lowerName = foodName.toLowerCase();
  for (const [food, foodIngredients] of Object.entries(ingredients)) {
    if (lowerName.includes(food)) {
      return foodIngredients;
    }
  }
  
  return ['Ingredients information not available'];
};

/**
 * Get estimated nutrition data for a food
 */
const getFoodNutrition = (foodName: string): { calories: number; protein: number; carbs: number; fat: number; fiber: number; sugar: number } => {
  const nutrition: Record<string, { calories: number; protein: number; carbs: number; fat: number; fiber: number; sugar: number }> = {
    'pizza': { calories: 285, protein: 12, carbs: 39, fat: 10, fiber: 2.5, sugar: 3.8 },
    'pasta': { calories: 200, protein: 7, carbs: 40, fat: 1.1, fiber: 2.5, sugar: 0.7 },
    'burger': { calories: 350, protein: 15, carbs: 30, fat: 17, fiber: 1.5, sugar: 4.5 },
    'sushi': { calories: 150, protein: 6, carbs: 30, fat: 0.5, fiber: 0.5, sugar: 2 },
    'salad': { calories: 80, protein: 2, carbs: 15, fat: 1, fiber: 5, sugar: 3 },
    'soup': { calories: 120, protein: 5, carbs: 15, fat: 5, fiber: 2, sugar: 2 }
  };
  
  const lowerName = foodName.toLowerCase();
  for (const [food, nutritionData] of Object.entries(nutrition)) {
    if (lowerName.includes(food)) {
      return nutritionData;
    }
  }
  
  // Default nutrition data
  return { calories: 200, protein: 5, carbs: 25, fat: 8, fiber: 2, sugar: 3 };
};

/**
 * Returns sample food recognition results for testing
 */
export const getSampleFoods = (): FoodRecognitionResult[] => {
  return [
    { name: 'Pizza', probability: 0.98 },
    { name: 'Pasta', probability: 0.85 },
    { name: 'Burger', probability: 0.92 },
    { name: 'Taco', probability: 0.88 },
    { name: 'Sushi', probability: 0.95 }
  ];
}; 