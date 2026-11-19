import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';

/**
 * Custom hook that provides strongly typed navigation throughout the app
 * This helps with autocompletion and type checking for navigation actions
 */
const useAppNavigation = () => {
  return useNavigation<NativeStackNavigationProp<RootStackParamList>>();
};

export default useAppNavigation; 