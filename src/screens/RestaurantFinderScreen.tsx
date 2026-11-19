import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ExploreStackParamList } from '../types/navigation';
import NearbyRestaurants from '../components/NearbyRestaurants';

type Props = NativeStackScreenProps<ExploreStackParamList, 'RestaurantFinder'>;

const RestaurantFinderScreen: React.FC<Props> = ({ route, navigation }) => {
  const { mealName } = route.params;

  const handleClose = () => {
    navigation.goBack();
  };

  return (
    <NearbyRestaurants 
      foodName={mealName} 
      onClose={handleClose} 
    />
  );
};

export default RestaurantFinderScreen; 