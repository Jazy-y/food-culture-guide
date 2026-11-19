> Historical implementation notes. For current installation and configuration, see [README](../../README.md). Some described behavior is experimental.

# Advanced Restaurant Finder Feature

## Overview
The advanced restaurant finder feature allows users to discover restaurants serving specific food items they've identified through the app. Using the user's current location, it presents nearby restaurants on a map and in a list, with detailed information and filtering options.

## Key Features
- **Real-time restaurant search** based on identified food type
- **Interactive map view** showing restaurant locations relative to the user
- **Advanced filtering options**:
  - Sort by distance, rating, or price
  - Filter by price range ($ to $$$$)
  - Filter for currently open restaurants
- **Restaurant details**:
  - Name, cuisine, and address
  - Ratings with reviewers count
  - Open/closed status
  - Distance from current location
  - Price level indicators
  - Delivery availability indicator
- **Search functionality** to find specific restaurants
- **Navigation integration** to get directions to restaurants
- **Pull-to-refresh** for updated results

## Setup Instructions

### Google API Key Configuration
The restaurant finder feature uses the Google Places API and related services. Follow these steps to set up your API key:

1. Visit the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Navigate to "APIs & Services" > "Library"
4. Enable the following APIs:
   - Places API
   - Maps JavaScript API
   - Directions API
   - Geocoding API

5. Create an API key:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Restrict the key to the APIs listed above

6. Add the API key to your app.config.js:
   ```javascript
   googlePlacesApiKey: "YOUR_GOOGLE_PLACES_API_KEY",
   ```

7. Add appropriate app permissions:
   - For iOS, update Info.plist with location usage description
   - For Android, ensure location permissions are included in AndroidManifest.xml

### Testing the Feature
The feature includes a fallback mode using mock data, so you can test it even without a valid API key or in development mode.

## User Flow

1. When a user identifies a food item through the app's recognition feature, they'll see a prominent "Find Restaurants Nearby" button
2. Tapping this button opens the restaurant finder interface showing:
   - A map with restaurant locations marked
   - A list of nearby restaurants serving that food type
3. Users can:
   - Filter and sort restaurants using the filter options
   - Search for specific restaurant names or cuisines
   - Tap a restaurant to see its details
   - Get directions to a selected restaurant
   - Pull down to refresh restaurant data

## Technical Implementation

### Key Components

1. **RestaurantService** (`src/services/restaurant-service.ts`)
   - Main service handling API requests to Google Places
   - Provides filtering, sorting, and caching of restaurant data
   - Includes fallback mode with simulated data for development

2. **NearbyRestaurants** (`src/components/NearbyRestaurants.tsx`)
   - UI component displaying the restaurant finder interface
   - Handles user interactions, filtering, and map display
   - Manages state for restaurant data and filters

3. **Integration with Food Recognition**
   - `FoodRecognitionScreen` provides a button to launch the restaurant finder
   - Passes the recognized food name to the restaurant finder

### Features and Best Practices

1. **Data Caching**
   - Results are cached for 5 minutes to reduce API calls
   - Cache is invalidated when filters change

2. **Error Handling**
   - Graceful fallback to mock data when API fails
   - User-friendly error messages and retry options

3. **Location Permissions**
   - Proper handling of location permission requests
   - Fallback options when location is unavailable

4. **Performance Optimization**
   - Efficient list rendering with FlatList
   - Map marker optimization

## Maintenance and Support

### API Limits and Billing
- The Google Places API has usage limits and billing
- Monitor your API usage in the Google Cloud Console
- Set up billing alerts to avoid unexpected charges

### Troubleshooting
- If restaurants aren't showing, check:
  - API key restrictions and billing status
  - Location permissions
  - Internet connectivity
  
### Future Enhancements
- Integration with restaurant reservation systems
- User reviews and ratings
- Menu information
- Food photos from restaurants

## Acknowledgements
This feature uses the following APIs and services:
- Google Places API
- Google Maps JavaScript API
- Google Directions API
- Google Geocoding API
- Expo Location services
- React Native Maps 