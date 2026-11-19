import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Alert,
  TextInput,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RestaurantService, { RestaurantSortOption, PriceFilterOption } from '../services/restaurant-service';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';

interface Restaurant {
  id: string;
  name: string;
  address: string;
  distance: number;
  rating?: number;
  cuisine?: string;
  priceLevel?: number;
  priceText?: string;
  photoUrl?: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  isOpen?: boolean;
  userRatingsTotal?: number;
  deliveryAvailable?: boolean;
}

interface Props {
  foodName: string;
  onClose: () => void;
}

const NearbyRestaurants: React.FC<Props> = ({ foodName, onClose }) => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [searchRadius] = useState(3000); // 3km default
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [mapError, setMapError] = useState(false);
  
  // Filter states
  const [sortBy, setSortBy] = useState<RestaurantSortOption>('distance');
  const [priceFilter, setPriceFilter] = useState<PriceFilterOption>('all');
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  const mapRef = useRef<MapView>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    // Set a timeout to show a message if loading takes too long
    const timeoutId = setTimeout(() => {
      if (loading) {
        setLoadingTimeout(true);
      }
    }, 15000); // 15 seconds timeout

    return () => clearTimeout(timeoutId);
  }, [loading]);

  useEffect(() => {
    getUserLocation();
  }, [foodName]);
  
  useEffect(() => {
    // Filter restaurants based on search query and other filters
    if (restaurants.length > 0) {
      let results = [...restaurants];
      
      // Apply search query filter
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        results = results.filter(restaurant => 
          restaurant.name.toLowerCase().includes(query) || 
          restaurant.cuisine?.toLowerCase().includes(query) ||
          restaurant.address.toLowerCase().includes(query)
        );
      }
      
      setFilteredRestaurants(results);
    }
  }, [restaurants, searchQuery]);

  const getUserLocation = async () => {
    try {
      setLoading(true);
      setError(null);
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        console.log('Location permission denied, using default location');
        // Use a default location if permission is denied
        setUserLocation({
          latitude: 36.8065, // Default Tunisia coordinates
          longitude: 10.1815,
        });
        
        // Still try to fetch restaurants with default location
        await fetchRestaurants();
        return;
      }
      
      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000, // 5 seconds
          mayShowUserSettingsDialog: true
        });
      
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch (locationError) {
        console.warn('Error getting precise location:', locationError);
        // Try to get last known location as fallback
        try {
          const lastLocation = await Location.getLastKnownPositionAsync();
          if (lastLocation) {
            setUserLocation({
              latitude: lastLocation.coords.latitude,
              longitude: lastLocation.coords.longitude,
            });
          } else {
            throw new Error('No last known location');
          }
        } catch (lastLocationError) {
          console.error('Failed to get any location:', lastLocationError);
          // Use default location
          setUserLocation({
            latitude: 36.8065, // Default Tunisia coordinates
            longitude: 10.1815,
          });
        }
      }
      
      // Once we have location, fetch restaurants
      await fetchRestaurants();
    } catch (error) {
      console.error('Location service error:', error);
      setError('Could not get your location. Using default location.');
      
      // Use default location (Tunisia) if we can't get user location
      setUserLocation({
        latitude: 36.8065,
        longitude: 10.1815,
      });
      
      // Still try to fetch restaurants with default location
      await fetchRestaurants();
    } finally {
      setLoading(false);
    }
  };

  const fetchRestaurants = async (forceRefresh = false) => {
    try {
      if (!forceRefresh) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      
      setError(null);
      
      // Set a timeout to prevent endless loading
      const timeoutPromise = new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Request timed out')), 15000)
      );
      
      // If we don't have a location yet, use a default for Tunisia
      const searchLocation = userLocation || { latitude: 36.8065, longitude: 10.1815 };
      
      console.log(`Fetching restaurants for "${foodName}" near [${searchLocation.latitude}, ${searchLocation.longitude}]`);
      
      try {
        // Race the API request against a timeout
        const result = await Promise.race([
          RestaurantService.findRestaurantsForFood(foodName, {
            radiusInMeters: searchRadius,
            sortBy: sortBy,
            priceFilter: priceFilter,
            openNow: openNowOnly,
          }),
          timeoutPromise
        ]);
        
        if (result && result.success && result.restaurants.length > 0) {
          console.log(`Found ${result.restaurants.length} restaurants`);
          setRestaurants(result.restaurants);
          setFilteredRestaurants(result.restaurants);
          
          // Set initial map region if we have results
          if (mapRef.current && result.restaurants.length > 0) {
            // Calculate center point and delta from all restaurant locations
            const lats = result.restaurants.map(r => r.coordinates.latitude);
            const lngs = result.restaurants.map(r => r.coordinates.longitude);
            
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);
            const minLng = Math.min(...lngs);
            const maxLng = Math.max(...lngs);
            
            // Add user location to the mix
            const allLats = [...lats, searchLocation.latitude];
            const allLngs = [...lngs, searchLocation.longitude];
            
            const centerLat = (minLat + maxLat) / 2;
            const centerLng = (minLng + maxLng) / 2;
            
            // Calculate appropriate deltas to fit all markers
            const latDelta = Math.max(0.02, (maxLat - minLat) * 1.5);
            const lngDelta = Math.max(0.02, (maxLng - minLng) * 1.5);
            
            mapRef.current.animateToRegion({
              latitude: centerLat,
              longitude: centerLng,
              latitudeDelta: latDelta,
              longitudeDelta: lngDelta,
            }, 1000);
          }
        } else if (result && result.success && result.restaurants.length === 0) {
          console.warn('No restaurants found');
          
          // Fallback to local data immediately
          console.log('Using local restaurant data as fallback');
          const localRestaurants = generateLocalRestaurants(foodName);
          setRestaurants(localRestaurants);
          setFilteredRestaurants(localRestaurants);
          
          // Still show a note to the user
          setError(`No restaurants found for "${foodName}". Showing sample results instead.`);
        } else {
          console.warn('Restaurant service error:', result?.errorMessage);
          
          // Fallback to local data
          console.log('Using local restaurant data after API error');
          const localRestaurants = generateLocalRestaurants(foodName);
          setRestaurants(localRestaurants);
          setFilteredRestaurants(localRestaurants);
          
          // Still show error to the user
          setError(result?.errorMessage || 'Failed to find restaurants. Showing sample results instead.');
        }
      } catch (timeoutError) {
        console.error('Request timed out or errored:', timeoutError);
        
        // Use local data on timeout
        console.log('Using local restaurant data after timeout');
        const localRestaurants = generateLocalRestaurants(foodName);
        setRestaurants(localRestaurants);
        setFilteredRestaurants(localRestaurants);
        
        setError('Restaurant search timed out. Showing sample results instead.');
      }
    } catch (error) {
      console.error('Error fetching restaurants:', error);
      
      // Final fallback
      const localRestaurants = generateLocalRestaurants(foodName);
      setRestaurants(localRestaurants);
      setFilteredRestaurants(localRestaurants);
      
      setError('Failed to load restaurants. Showing sample results instead.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const handleRefresh = () => {
    fetchRestaurants(true);
  };

  const handleGetDirections = (restaurant: Restaurant) => {
    try {
      const url = RestaurantService.getDirectionsToRestaurant(restaurant);
      Linking.openURL(url);
    } catch (error) {
      Alert.alert('Error', 'Could not open maps application');
    }
  };
  
  const handleRestaurantSelect = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
    
    // Animate map to selected restaurant
    if (mapRef.current && restaurant.coordinates) {
      mapRef.current.animateToRegion({
        latitude: restaurant.coordinates.latitude,
        longitude: restaurant.coordinates.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    }
    
    // Scroll to the selected restaurant in the list
    if (listRef.current) {
      const index = filteredRestaurants.findIndex(r => r.id === restaurant.id);
      if (index !== -1) {
        listRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      }
    }
  };
  
  const applyFilters = () => {
    setShowFilters(false);
    fetchRestaurants();
  };
  
  const resetFilters = () => {
    setSortBy('distance');
    setPriceFilter('all');
    setOpenNowOnly(false);
    setSearchQuery('');
    setShowFilters(false);
    fetchRestaurants();
  };

  const renderStars = (rating?: number, item?: Restaurant) => {
    if (!rating) return null;
    
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    
    return (
      <View style={styles.starsContainer}>
        {[...Array(fullStars)].map((_, i) => (
          <Ionicons key={`full-${i}`} name="star" size={16} color="#FFD700" />
        ))}
        {halfStar && <Ionicons name="star-half" size={16} color="#FFD700" />}
        {[...Array(emptyStars)].map((_, i) => (
          <Ionicons key={`empty-${i}`} name="star-outline" size={16} color="#FFD700" />
        ))}
        {item?.userRatingsTotal && (
          <Text style={styles.ratingText}>({item.userRatingsTotal})</Text>
        )}
      </View>
    );
  };

  const renderPriceLevel = (restaurant: Restaurant) => {
    if (!restaurant.priceText) return null;
    
    return (
      <Text style={styles.priceLevel}>
        {restaurant.priceText}
      </Text>
    );
  };

  const renderRestaurantItem = ({ item }: { item: Restaurant }) => (
    <TouchableOpacity 
      style={[
        styles.restaurantItem,
        selectedRestaurant?.id === item.id && styles.selectedRestaurantItem
      ]}
      onPress={() => handleRestaurantSelect(item)}
    >
      <View style={styles.restaurantInfo}>
        <View style={styles.restaurantHeader}>
          <Text style={styles.restaurantName}>{item.name}</Text>
          {renderPriceLevel(item)}
        </View>
        
        <View style={styles.ratingRow}>
          {renderStars(item.rating, item)}
          {item.isOpen ? (
            <Text style={styles.openNow}>Open Now</Text>
          ) : (
            <Text style={styles.closed}>Closed</Text>
          )}
          {item.deliveryAvailable && (
            <View style={styles.deliveryBadge}>
              <Text style={styles.deliveryText}>Delivery</Text>
            </View>
          )}
        </View>
        
        <Text style={styles.cuisine}>{item.cuisine}</Text>
        <Text style={styles.address}>{item.address}</Text>
        <Text style={styles.distance}>{(item.distance / 1000).toFixed(1)} km away</Text>
        
        <TouchableOpacity
          style={styles.directionsButton}
          onPress={() => handleGetDirections(item)}
        >
          <Ionicons name="navigate" size={16} color="#fff" />
          <Text style={styles.directionsText}>Directions</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderMap = () => {
    if (!userLocation) {
      return (
        <View style={styles.mapContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Getting location...</Text>
        </View>
      );
    }
    
    // Don't attempt to render the map if there are no restaurants
    if (filteredRestaurants.length === 0 && !loading) {
      return (
        <View style={styles.mapContainer}>
          <Text style={styles.mapPlaceholderText}>No restaurants to display on map</Text>
        </View>
      );
    }
    
    if (mapError) {
      return (
        <View style={styles.mapContainer}>
          <Text style={styles.mapPlaceholderText}>
            Could not load map. Restaurant list is available below.
          </Text>
        </View>
      );
    }
    
    try {
      return (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            showsUserLocation
            showsMyLocationButton
            showsCompass
            loadingEnabled
            onLayout={(event) => {
              const {width, height} = event.nativeEvent.layout;
              if (width === 0 || height === 0) {
                console.warn('Map has zero dimensions');
                setMapError(true);
              }
            }}
          >
            {/* Mark user's position */}
            <Marker
              key="user-location"
              coordinate={{
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
              }}
              title="You are here"
              pinColor="#3498db"
            />
            
            {/* Restaurant markers */}
            {filteredRestaurants.map(restaurant => {
              // Verify coordinates are valid numbers before creating marker
              if (isNaN(restaurant.coordinates.latitude) || isNaN(restaurant.coordinates.longitude)) {
                return null;
              }
              
              return (
                <Marker
                  key={restaurant.id}
                  coordinate={{
                    latitude: restaurant.coordinates.latitude,
                    longitude: restaurant.coordinates.longitude,
                  }}
                  title={restaurant.name}
                  description={restaurant.address}
                  pinColor={selectedRestaurant?.id === restaurant.id ? '#FF6B35' : '#e74c3c'}
                  onPress={() => handleRestaurantSelect(restaurant)}
                />
              );
            })}
          </MapView>
        </View>
      );
    } catch (mapRenderError) {
      console.error('Error rendering map:', mapRenderError);
      setMapError(true);
      return (
        <View style={styles.mapContainer}>
          <Text style={styles.mapPlaceholderText}>
            Could not load map. Restaurant list is available below.
          </Text>
        </View>
      );
    }
  };
  
  const renderSearchBar = () => (
    <View style={styles.searchBarContainer}>
      <View style={styles.searchInputContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search restaurants..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>
      
      <TouchableOpacity 
        style={styles.filterButton} 
        onPress={() => setShowFilters(!showFilters)}
      >
        <Ionicons name="options" size={22} color="#FF6B35" />
      </TouchableOpacity>
    </View>
  );
  
  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      <Text style={styles.filterTitle}>Sort By</Text>
      <View style={styles.filterOptionsRow}>
        <TouchableOpacity
          style={[styles.filterOption, sortBy === 'distance' && styles.filterOptionSelected]}
          onPress={() => setSortBy('distance')}
        >
          <Text style={[styles.filterOptionText, sortBy === 'distance' && styles.filterOptionTextSelected]}>
            Distance
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterOption, sortBy === 'rating' && styles.filterOptionSelected]}
          onPress={() => setSortBy('rating')}
        >
          <Text style={[styles.filterOptionText, sortBy === 'rating' && styles.filterOptionTextSelected]}>
            Rating
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterOption, sortBy === 'price' && styles.filterOptionSelected]}
          onPress={() => setSortBy('price')}
        >
          <Text style={[styles.filterOptionText, sortBy === 'price' && styles.filterOptionTextSelected]}>
            Price
          </Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.filterTitle}>Price Range</Text>
      <View style={styles.filterOptionsRow}>
        <TouchableOpacity
          style={[styles.filterOption, priceFilter === 'all' && styles.filterOptionSelected]}
          onPress={() => setPriceFilter('all')}
        >
          <Text style={[styles.filterOptionText, priceFilter === 'all' && styles.filterOptionTextSelected]}>
            All
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterOption, priceFilter === '1' && styles.filterOptionSelected]}
          onPress={() => setPriceFilter('1')}
        >
          <Text style={[styles.filterOptionText, priceFilter === '1' && styles.filterOptionTextSelected]}>
            $
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterOption, priceFilter === '2' && styles.filterOptionSelected]}
          onPress={() => setPriceFilter('2')}
        >
          <Text style={[styles.filterOptionText, priceFilter === '2' && styles.filterOptionTextSelected]}>
            $$
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterOption, priceFilter === '3' && styles.filterOptionSelected]}
          onPress={() => setPriceFilter('3')}
        >
          <Text style={[styles.filterOptionText, priceFilter === '3' && styles.filterOptionTextSelected]}>
            $$$
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterOption, priceFilter === '4' && styles.filterOptionSelected]}
          onPress={() => setPriceFilter('4')}
        >
          <Text style={[styles.filterOptionText, priceFilter === '4' && styles.filterOptionTextSelected]}>
            $$$$
          </Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.filterTitle}>Additional Filters</Text>
      <View style={styles.filterOptionsRow}>
        <TouchableOpacity
          style={[styles.filterOption, openNowOnly && styles.filterOptionSelected]}
          onPress={() => setOpenNowOnly(!openNowOnly)}
        >
          <Text style={[styles.filterOptionText, openNowOnly && styles.filterOptionTextSelected]}>
            Open Now
          </Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.filterActions}>
        <TouchableOpacity
          style={styles.resetFilterButton}
          onPress={resetFilters}
        >
          <Text style={styles.resetFilterText}>Reset</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.applyFilterButton}
          onPress={applyFilters}
        >
          <Text style={styles.applyFilterText}>Apply Filters</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderContent = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Finding restaurants...</Text>
          
          {loadingTimeout && (
            <View style={styles.timeoutContainer}>
              <Text style={styles.timeoutText}>
                This is taking longer than expected. The app might have issues connecting to restaurant data in your region.
              </Text>
              <TouchableOpacity 
                style={styles.retryButton}
                onPress={() => {
                  setLoadingTimeout(false);
                  fetchRestaurants();
                }}
              >
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.useMockDataButton}
                onPress={() => {
                  // Force get mock restaurants
                  setLoading(false);
                  const mockRestaurants = generateLocalRestaurants(foodName);
                  setRestaurants(mockRestaurants);
                  setFilteredRestaurants(mockRestaurants);
                }}
              >
                <Text style={styles.useMockDataText}>Show Sample Restaurants</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    } 
    
    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={48} color="#FF6B35" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => fetchRestaurants()}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.useMockDataButton}
            onPress={() => {
              // Force get mock restaurants
              setError(null);
              const mockRestaurants = generateLocalRestaurants(foodName);
              setRestaurants(mockRestaurants);
              setFilteredRestaurants(mockRestaurants);
            }}
          >
            <Text style={styles.useMockDataText}>Show Sample Restaurants</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    return (
      <FlatList
        ref={listRef}
        data={filteredRestaurants}
        renderItem={renderRestaurantItem}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          filteredRestaurants.length === 0 && styles.emptyList
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={["#FF6B35"]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="restaurant-outline" size={64} color="#ddd" />
            <Text style={styles.emptyText}>No restaurants found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your filters or search</Text>
            <TouchableOpacity 
              style={styles.useMockDataButton}
              onPress={() => {
                const mockRestaurants = generateLocalRestaurants(foodName);
                setRestaurants(mockRestaurants);
                setFilteredRestaurants(mockRestaurants);
              }}
            >
              <Text style={styles.useMockDataText}>Show Sample Restaurants</Text>
            </TouchableOpacity>
          </View>
        }
        onScrollToIndexFailed={(info) => {
          console.warn('Failed to scroll to index:', info);
        }}
      />
    );
  };

  // Add this function to generate local restaurants
  const generateLocalRestaurants = (foodType: string): Restaurant[] => {
    const mockRestaurants: Restaurant[] = [];
    const restaurantNames = [
      "The " + foodType + " House",
      "Gourmet " + foodType + " Restaurant",
      "Authentic " + foodType + " Kitchen",
      "Mama's " + foodType + " Place",
      "Royal " + foodType + " Dining",
      "Fast & Delicious " + foodType,
      "Traditional " + foodType + " Palace",
      foodType + " Express",
      "Fresh " + foodType + " Bar",
      "The Local " + foodType + " Joint"
    ];
    
    // Get base coordinates from user location or default Tunisia coordinates
    const baseLatitude = userLocation?.latitude || 36.8065;
    const baseLongitude = userLocation?.longitude || 10.1815;
    
    // Create 10 mock restaurants
    for (let i = 0; i < 10; i++) {
      // Generate a random distance in meters (up to 5km)
      const distanceMeters = Math.random() * 5000;
      
      // Convert to a coordinate offset (very approximate)
      // This creates a random point around the user in a rough circle
      const angle = Math.random() * Math.PI * 2;
      const latOffset = (Math.sin(angle) * distanceMeters) / 111111;
      const lngOffset = (Math.cos(angle) * distanceMeters) / (111111 * Math.cos(baseLatitude * (Math.PI / 180)));
      
      // Calculate new coordinates
      const latitude = baseLatitude + latOffset;
      const longitude = baseLongitude + lngOffset;
      
      // Rating between 3.5 and 5.0
      const rating = 3.5 + Math.random() * 1.5;
      
      // Price level between 1-4
      const priceLevel = Math.floor(Math.random() * 4) + 1;
      
      // Generate price text
      const priceText = Array(priceLevel).fill('$').join('');
      
      const restaurant: Restaurant = {
        id: `local-${i}-${Date.now()}`, // Add timestamp to ensure uniqueness
        name: restaurantNames[i],
        address: `${Math.floor(Math.random() * 1000) + 100} Main Street`,
        distance: distanceMeters,
        rating: Math.round(rating * 10) / 10,
        cuisine: foodType,
        priceLevel: priceLevel,
        priceText: priceText,
        coordinates: {
          latitude: latitude,
          longitude: longitude
        },
        photoUrl: `https://source.unsplash.com/featured/?${encodeURIComponent(foodType)},restaurant&sig=${i}`,
        isOpen: Math.random() > 0.2, // 80% chance of being open
        userRatingsTotal: Math.floor(Math.random() * 500) + 50,
        deliveryAvailable: Math.random() > 0.5 // 50% chance of delivery
      };
      
      mockRestaurants.push(restaurant);
    }
    
    return mockRestaurants;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Restaurants serving {foodName}</Text>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={24} color="#333" />
        </TouchableOpacity>
      </View>
      
      {renderMap()}
      {renderSearchBar()}
      
      {showFilters && renderFilters()}
      
      {renderContent()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    elevation: 2,
    zIndex: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  closeButton: {
    padding: 8,
  },
  mapContainer: {
    height: 200,
    width: '100%',
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  searchBarContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f3f4',
    borderRadius: 20,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: '#333',
    fontSize: 16,
  },
  filterButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#f1f3f4',
  },
  filtersContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  filterOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f3f4',
    marginRight: 8,
    marginBottom: 8,
  },
  filterOptionSelected: {
    backgroundColor: '#FF6B35',
  },
  filterOptionText: {
    color: '#666',
    fontSize: 14,
  },
  filterOptionTextSelected: {
    color: '#fff',
    fontWeight: '500',
  },
  filterActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  resetFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 4,
    marginRight: 8,
  },
  resetFilterText: {
    color: '#666',
    fontSize: 14,
  },
  applyFilterButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 4,
  },
  applyFilterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 16,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 300,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 300,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 4,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#333',
    fontWeight: '500',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  restaurantItem: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  selectedRestaurantItem: {
    borderWidth: 2,
    borderColor: '#FF6B35',
  },
  restaurantInfo: {
    padding: 16,
  },
  restaurantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  restaurantName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  priceLevel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  ratingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  openNow: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
    marginLeft: 8,
  },
  closed: {
    fontSize: 12,
    color: '#F44336',
    fontWeight: '500',
    marginLeft: 8,
  },
  deliveryBadge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  deliveryText: {
    fontSize: 12,
    color: '#1976D2',
    fontWeight: '500',
  },
  cuisine: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  address: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  distance: {
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: '500',
    marginBottom: 12,
  },
  directionsButton: {
    backgroundColor: '#FF6B35',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  directionsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  mapPlaceholder: {
    height: 200,
    backgroundColor: '#f1f3f4',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  mapPlaceholderText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    paddingHorizontal: 16,
    textAlign: 'center',
  },
  timeoutContainer: {
    marginTop: 24,
    alignItems: 'center',
    padding: 16,
  },
  timeoutText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  useMockDataButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 4,
    marginTop: 8,
  },
  useMockDataText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default NearbyRestaurants; 