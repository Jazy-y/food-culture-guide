import axios from "axios";

const BASE_URL = "https://www.themealdb.com/api/json/v1/1";

export interface Meal {
  idMeal: string;
  strMeal: string;
  strMealThumb: string;
  strCategory?: string;
  strArea?: string;
  strInstructions?: string;
  price?: string;
  rating?: number;
  ratingCount?: number;
}

export interface MealDBResponse {
  meals: Meal[] | null;
}

class MealDBService {
  private mealCache: { [key: string]: Meal[] } = {};
  private mealEnhancementCache: {
    [key: string]: { price: string; rating: number; ratingCount: number };
  } = {};
  private countriesCache: string[] | null = null;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;

  // Add fallback meal data for offline scenarios
  private fallbackMeals: { [key: string]: Meal[] } = {
    "American": [
      {
        idMeal: "offline_am_1",
        strMeal: "Classic Hamburger",
        strMealThumb: "https://www.themealdb.com/images/media/meals/ustsqw1468250014.jpg",
        strCategory: "Beef",
        strArea: "American",
        price: "15.99 DT",
        rating: 4.7,
        ratingCount: 230
      },
      {
        idMeal: "offline_am_2",
        strMeal: "Apple Pie",
        strMealThumb: "https://www.themealdb.com/images/media/meals/qtqwwu1511792650.jpg",
        strCategory: "Dessert",
        strArea: "American",
        price: "12.50 DT",
        rating: 4.8,
        ratingCount: 185
      },
      {
        idMeal: "offline_am_3",
        strMeal: "Mac & Cheese",
        strMealThumb: "https://www.themealdb.com/images/media/meals/xqrwyr1511133646.jpg",
        strCategory: "Side",
        strArea: "American",
        price: "10.99 DT",
        rating: 4.5,
        ratingCount: 156
      }
    ],
    "Italian": [
      {
        idMeal: "offline_it_1",
        strMeal: "Spaghetti Carbonara",
        strMealThumb: "https://www.themealdb.com/images/media/meals/llcbn01574260722.jpg",
        strCategory: "Pasta",
        strArea: "Italian",
        price: "18.50 DT",
        rating: 4.9,
        ratingCount: 310
      },
      {
        idMeal: "offline_it_2",
        strMeal: "Margherita Pizza",
        strMealThumb: "https://www.themealdb.com/images/media/meals/x0lk931587671540.jpg",
        strCategory: "Pizza",
        strArea: "Italian",
        price: "16.99 DT",
        rating: 4.6,
        ratingCount: 278
      }
    ],
    "Tunisian": [
      {
        idMeal: "offline_tn_1",
        strMeal: "Couscous",
        strMealThumb: "https://www.themealdb.com/images/media/meals/1550440197.jpg",
        strCategory: "Main",
        strArea: "Tunisian",
        price: "19.99 DT",
        rating: 4.9,
        ratingCount: 290
      },
      {
        idMeal: "offline_tn_2",
        strMeal: "Brik",
        strMealThumb: "https://www.themealdb.com/images/media/meals/8693ae1565030843.jpg",
        strCategory: "Appetizer",
        strArea: "Tunisian",
        price: "8.50 DT",
        rating: 4.7,
        ratingCount: 210
      },
      {
        idMeal: "offline_tn_3",
        strMeal: "Lablabi",
        strMealThumb: "https://www.themealdb.com/images/media/meals/1550441882.jpg",
        strCategory: "Soup",
        strArea: "Tunisian",
        price: "7.99 DT",
        rating: 4.5,
        ratingCount: 180
      }
    ]
  };

  // Default countries list for offline scenarios
  private defaultCountries: string[] = [
    "American", "British", "Canadian", "Chinese", "Dutch", "Egyptian", "French", 
    "Greek", "Indian", "Irish", "Italian", "Jamaican", "Japanese", "Kenyan", 
    "Malaysian", "Mexican", "Moroccan", "Portuguese", "Russian", "Spanish", 
    "Thai", "Tunisian", "Turkish", "Vietnamese"
  ];

  constructor() {
    // Don't auto-initialize, wait for explicit initialization
    this.initializationPromise = null;
  }

  public async initialize() {
    if (this.initialized) {
      console.log("MealDBService already initialized");
      return;
    }

    if (this.initializationPromise) {
      console.log("MealDBService initialization in progress, waiting...");
      return this.initializationPromise;
    }

    console.log("Starting MealDBService initialization");
    this.initializationPromise = this.initializeInternal();
    return this.initializationPromise;
  }

  private async initializeInternal() {
    try {
      console.log("Fetching countries...");
      const countries = await this.getCountries();
      console.log(`Fetched ${countries.length} countries`);
      
      console.log("Pre-fetching meals for each country...");
      const results = await Promise.allSettled(
        countries.map(async (country) => {
          try {
            await this.prefetchMealsForCountry(country);
            console.log(`Successfully pre-fetched meals for ${country}`);
            return country;
          } catch (error) {
            console.error(`Failed to pre-fetch meals for ${country}:`, error);
            return null;
          }
        })
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      console.log(`Pre-fetched meals for ${successful}/${countries.length} countries`);

      this.initialized = true;
      console.log("MealDBService initialization complete");
    } catch (error) {
      console.error("Error during MealDBService initialization:", error);
      this.initializationPromise = null;
      throw error;
    }
  }

  private generateRandomPrice(): string {
    const min = 10;
    const max = 30;
    return `${(Math.random() * (max - min) + min).toFixed(2)} DT`;
  }

  private generateRandomRating(): { rating: number; ratingCount: number } {
    return {
      rating: Number((Math.random() * (5 - 4) + 4).toFixed(1)),
      ratingCount: Math.floor(Math.random() * (300 - 50) + 50),
    };
  }

  private getOrCreateEnhancement(mealId: string) {
    if (!this.mealEnhancementCache[mealId]) {
      this.mealEnhancementCache[mealId] = {
        price: this.generateRandomPrice(),
        ...this.generateRandomRating(),
      };
    }
    return this.mealEnhancementCache[mealId];
  }

  private enhanceMeals(meals: Meal[]): Meal[] {
    return meals.map((meal) => ({
      ...meal,
      ...this.getOrCreateEnhancement(meal.idMeal),
    }));
  }

  private normalizeCountryName(country: string): string {
    const countryMap: { [key: string]: string } = {
      america: "American",
      american: "American",
      "american cuisine": "American",
      usa: "American",
      "united states": "American",
      britain: "British",
      british: "British",
      uk: "British",
      "united kingdom": "British",
      china: "Chinese",
      chinese: "Chinese",
      france: "French",
      french: "French",
      india: "Indian",
      indian: "Indian",
      italy: "Italian",
      italian: "Italian",
      japan: "Japanese",
      japanese: "Japanese",
      mexico: "Mexican",
      mexican: "Mexican",
      spain: "Spanish",
      spanish: "Spanish",
      thailand: "Thai",
      thai: "Thai",
      tunisia: "Tunisian",
      tunisian: "Tunisian",
    };

    const normalized = countryMap[country.toLowerCase()];
    return normalized || country;
  }

  private async prefetchMealsForCountry(country: string) {
    try {
      console.log(`Pre-fetching meals for ${country}...`);
      const normalizedCountry = this.normalizeCountryName(country);
      const response = await axios.get<MealDBResponse>(
        `${BASE_URL}/filter.php?a=${normalizedCountry}`
      );

      if (response.data.meals) {
        const enhancedMeals = this.enhanceMeals(response.data.meals);
        this.mealCache[country] = enhancedMeals;
        this.mealCache[normalizedCountry] = enhancedMeals;
        console.log(`Cached ${enhancedMeals.length} meals for ${country}`);
      } else {
        console.log(`No meals found for ${country}`);
      }
    } catch (error) {
      console.error(`Error pre-fetching meals for ${country}:`, error);
      throw error;
    }
  }

  async getCountries(): Promise<string[]> {
    if (this.countriesCache) {
      console.log("Returning cached countries list");
      return this.countriesCache;
    }

    try {
      console.log("Fetching countries from API...");
      const response = await axios.get<MealDBResponse>(
        `${BASE_URL}/list.php?a=list`
      );
      if (!response.data.meals) {
        console.log("No countries returned from API, using default countries");
        this.countriesCache = this.defaultCountries;
        return this.defaultCountries;
      }
      const countries = response.data.meals
        .map((meal) => meal.strArea || "")
        .filter((area) => area)
        .sort();
      
      this.countriesCache = countries;
      console.log(`Cached ${countries.length} countries`);
      return countries;
    } catch (error) {
      console.error("Error fetching countries:", error);
      console.log("Using default countries list as fallback");
      this.countriesCache = this.defaultCountries;
      return this.defaultCountries;
    }
  }

  async getMealsByCountry(country: string): Promise<Meal[]> {
    console.log(`Getting meals for ${country}...`);
    
    if (!this.initialized) {
      console.log("MealDBService not initialized, initializing now...");
      try {
        await this.initialize();
      } catch (error) {
        console.error("Initialization failed:", error);
      }
    }

    const normalizedCountry = this.normalizeCountryName(country);
    console.log(`Normalized country name: ${normalizedCountry}`);
    
    // First check if we already have these meals cached
    if (this.mealCache[normalizedCountry]) {
      console.log(`Returning ${this.mealCache[normalizedCountry].length} cached meals for ${normalizedCountry}`);
      return this.mealCache[normalizedCountry];
    }

    // No cache, try API with proper error handling
    try {
      console.log(`Fetching meals for ${normalizedCountry} from API...`);
      
      // Create a new axios instance with proper timeout settings
      const axiosInstance = axios.create({
        timeout: 10000, // 10 second timeout
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      const response = await axiosInstance.get<MealDBResponse>(
        `${BASE_URL}/filter.php?a=${normalizedCountry}`
      );

      // Check if we got a valid response with meals
      if (response.data && response.data.meals && response.data.meals.length > 0) {
        console.log(`API returned ${response.data.meals.length} meals for ${normalizedCountry}`);
        const enhancedMeals = this.enhanceMeals(response.data.meals);
        this.mealCache[normalizedCountry] = enhancedMeals;
        console.log(`Cached ${enhancedMeals.length} meals for ${normalizedCountry}`);
        return enhancedMeals;
      } else {
        console.log(`API returned no meals for ${normalizedCountry}`);
        
        // For empty responses for specific countries, return fallback data
        if (this.fallbackMeals[normalizedCountry]) {
          console.log(`Using fallback data for ${normalizedCountry}`);
          this.mealCache[normalizedCountry] = this.fallbackMeals[normalizedCountry];
          return this.mealCache[normalizedCountry];
        }
        
        // For American specifically, we must have meals
        if (normalizedCountry === 'American') {
          console.log('Forcing American fallback meals for empty API response');
          const americanMeals = this.fallbackMeals['American'] || [];
          this.mealCache[normalizedCountry] = americanMeals;
          return americanMeals;
        }
        
        return [];
      }
    } catch (error) {
      console.error(`API error fetching meals for ${country}:`, error);
      
      // On API error, check fallback cache
      if (this.fallbackMeals[normalizedCountry]) {
        console.log(`Using fallback data for ${normalizedCountry} after API error`);
        this.mealCache[normalizedCountry] = this.fallbackMeals[normalizedCountry];
        return this.mealCache[normalizedCountry];
      }
      
      // For American specifically, we must have meals even on error
      if (normalizedCountry === 'American') {
        console.log('Forcing American fallback meals after API error');
        const americanMeals = this.fallbackMeals['American'] || [];
        this.mealCache[normalizedCountry] = americanMeals;
        return americanMeals;
      }
      
      // For countries without specific fallback data, generate some generic items
      console.log(`Generating fallback data for ${normalizedCountry}`);
      const randomMeals: Meal[] = [
        {
          idMeal: `offline_${normalizedCountry.toLowerCase()}_1`,
          strMeal: `${normalizedCountry} Special Dish`,
          strMealThumb: "https://www.themealdb.com/images/media/meals/58oia61564916529.jpg",
          strArea: normalizedCountry,
          price: this.generateRandomPrice(),
          rating: 4.5,
          ratingCount: 120
        },
        {
          idMeal: `offline_${normalizedCountry.toLowerCase()}_2`,
          strMeal: `Traditional ${normalizedCountry} Food`,
          strMealThumb: "https://www.themealdb.com/images/media/meals/020z181619788503.jpg",
          strArea: normalizedCountry,
          price: this.generateRandomPrice(),
          rating: 4.3,
          ratingCount: 98
        }
      ];
      
      this.mealCache[normalizedCountry] = randomMeals;
      return randomMeals;
    }
  }

  async getMealDetails(mealId: string): Promise<Meal | null> {
    try {
      console.log(`Fetching details for meal ${mealId}...`);
      
      // Check if this is an offline-generated ID
      if (mealId.startsWith('offline_')) {
        console.log(`Generating offline details for meal ${mealId}`);
        
        // Extract country code from the ID (e.g., 'offline_am_1' -> 'am')
        const parts = mealId.split('_');
        const countryCode = parts[1] || '';
        
        // Find the meal in our fallback data
        for (const country in this.fallbackMeals) {
          const meal = this.fallbackMeals[country].find(m => m.idMeal === mealId);
          if (meal) {
            // Add more details for offline meal
            return {
              ...meal,
              strInstructions: `This is a traditional ${meal.strArea || country} dish that's popular among locals and tourists alike. The preparation involves local ingredients and traditional cooking methods. This offline meal data is provided as a fallback when the internet connection is limited.`,
            };
          }
        }
        
        // If not found in fallback data, create a generic one
        return {
          idMeal: mealId,
          strMeal: "Traditional Dish",
          strMealThumb: "https://www.themealdb.com/images/media/meals/020z181619788503.jpg",
          strCategory: "Main",
          strArea: countryCode.toUpperCase(),
          strInstructions: "This is a traditional dish that's popular among locals. Recipe details are currently unavailable in offline mode.",
          price: this.generateRandomPrice(),
          rating: 4.0,
          ratingCount: 100
        };
      }
      
      const response = await axios.get<MealDBResponse>(
        `${BASE_URL}/lookup.php?i=${mealId}`
      );
      if (!response.data.meals || !response.data.meals[0]) {
        console.log(`No details found for meal ${mealId}`);
        return null;
      }
      const enhancedMeal = {
        ...response.data.meals[0],
        ...this.getOrCreateEnhancement(mealId),
      };
      console.log(`Successfully fetched details for meal ${mealId}`);
      return enhancedMeal;
    } catch (error) {
      console.error(`Error fetching meal details for ${mealId}:`, error);
      
      // Create fallback meal details when offline
      console.log(`Creating fallback details for meal ${mealId}`);
      return {
        idMeal: mealId,
        strMeal: "Offline Dish",
        strMealThumb: "https://www.themealdb.com/images/media/meals/wuxrtu1483564410.jpg",
        strCategory: "Main",
        strArea: "Traditional",
        strInstructions: "This dish is currently available in offline mode only. Please connect to the internet to view the full recipe details.",
        price: this.generateRandomPrice(),
        rating: 4.0,
        ratingCount: 100
      };
    }
  }

  getIngredients(meal: any) {
    const ingredients: string[] = [];
    for (let i = 1; i <= 20; i++) {
      const ingredient = meal[`strIngredient${i}`];
      const measure = meal[`strMeasure${i}`];
      if (ingredient && ingredient.trim()) {
        ingredients.push(
          `${measure ? measure.trim() + " " : ""}${ingredient.trim()}`
        );
      }
    }
    return ingredients;
  }

  async searchMeals(query: string): Promise<Meal[]> {
    try {
      console.log(`Searching meals with query: ${query}`);
      
      // Try to get from API first
      try {
        const response = await axios.get<MealDBResponse>(
          `${BASE_URL}/search.php?s=${query}`
        );
        if (response.data.meals) {
          const enhancedMeals = this.enhanceMeals(response.data.meals);
          console.log(`Found ${enhancedMeals.length} meals matching query: ${query}`);
          return enhancedMeals;
        }
      } catch (apiError) {
        console.error(`API error searching meals with query "${query}":`, apiError);
      }
      
      // If API fails, search in cached meals
      console.log(`Searching in cached meals for query: ${query}`);
      const queryLower = query.toLowerCase();
      const results: Meal[] = [];
      
      // Search through all cached meals
      for (const country in this.mealCache) {
        const matchingMeals = this.mealCache[country].filter(meal => 
          meal.strMeal.toLowerCase().includes(queryLower) ||
          (meal.strCategory && meal.strCategory.toLowerCase().includes(queryLower)) ||
          country.toLowerCase().includes(queryLower)
        );
        
        results.push(...matchingMeals);
      }
      
      // Search in fallback meals if no results found
      if (results.length === 0) {
        console.log(`Searching in fallback meals for query: ${query}`);
        for (const country in this.fallbackMeals) {
          const matchingMeals = this.fallbackMeals[country].filter(meal => 
            meal.strMeal.toLowerCase().includes(queryLower) ||
            (meal.strCategory && meal.strCategory.toLowerCase().includes(queryLower)) ||
            country.toLowerCase().includes(queryLower)
          );
          
          results.push(...matchingMeals);
        }
      }
      
      console.log(`Found ${results.length} meals matching query: ${query} in cached/fallback data`);
      return results;
    } catch (error) {
      console.error(`Error searching meals with query "${query}":`, error);
      return [];
    }
  }
}

export const mealDBService = new MealDBService();