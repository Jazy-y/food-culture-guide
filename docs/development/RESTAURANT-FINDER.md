> Historical implementation notes. For current installation and configuration, see [README](../../README.md). Some described behavior is experimental.

# Food Culture Guide - Restaurant Finder Feature

## Overview

The Restaurant Finder feature allows users to find nearby restaurants that serve the identified food item. After the app recognizes a food item from an image, users can tap the "Find Restaurants Nearby" button to see a list of restaurants serving that cuisine in their vicinity.

## Features

- Map view of nearby restaurants with pins
- List view with restaurant details:
  - Name, address, rating (star display)
  - Distance from current location
  - Price level indication
  - Open/closed status
- Navigation option to get directions to selected restaurant
- Automatic handling of location permissions

## Implementation Details

### Components

1. **NearbyRestaurants** (`src/components/NearbyRestaurants.tsx`):
   - Modal component that displays restaurants on a map and in a list
   - Uses `react-native-maps` for the map display
   - Retrieves restaurant data from the RestaurantService
   - Provides directions functionality via device map apps

2. **RestaurantService** (`src/services/restaurant-service.ts`):
   - Service layer that handles the logic for finding nearby restaurants
   - Interfaces with Google Places API or provides mock data in development
   - Calculates distances, handles permissions, and formats restaurant data
   - Provides direction URL generation for navigation

3. **FoodRecognitionScreen Integration**:
   - "Find Restaurants Nearby" button added to the recognition results
   - Modal display for restaurant finder
   - Passing recognized food name to restaurant search

### Technical Approach

1. **Real API Integration**:
   - Uses Google Places API for production environment
   - Requires API key configuration in app.json/app.config.js
   - Fallback to mock data if API call fails

2. **Mock Data for Development**:
   - Generates realistic restaurant data based on food type
   - Simulates locations within the specified radius
   - Provides consistent results for the same search parameters

3. **Location Services**:
   - Handles location permission requests
   - Uses Expo Location for getting user coordinates
   - Provides helpful error messages when location is unavailable

## Setup Instructions

### API Key Configuration

To use the Google Places API, you'll need to add your API key to the app configuration:

1. Obtain a Google Places API key from the [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Enable the Places API and Maps API for your project
3. Add the API key to your app.config.js or app.json:

```javascript
// app.config.js
export default {
  expo: {
    // ... other expo config
    extra: {
      googlePlacesApiKey: "YOUR_API_KEY_HERE"
    }
  }
};
```

### Development without API Key

The feature will work in development mode with mock data. No API key is required for testing functionality.

## Usage

1. Take or upload a photo of food
2. After recognition, tap "Find Restaurants Nearby"
3. Grant location permission if prompted
4. View nearby restaurants on the map and in the list
5. Tap a restaurant to see details
6. Tap "Directions" to navigate to the selected restaurant

## Future Enhancements

- Restaurant filtering options (distance, rating, price)
- Restaurant reviews and detailed information
- Photo gallery for each restaurant
- Online ordering integration where available
- Restaurant booking/reservation functionality
- User reviews and favorites 