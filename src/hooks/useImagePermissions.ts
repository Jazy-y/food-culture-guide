import { useState, useEffect } from 'react';
import { Platform, Linking, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';

interface PermissionsState {
  cameraPermission: boolean | null;
  galleryPermission: boolean | null;
  loading: boolean;
  requestPermissions: () => Promise<void>;
  openSettings: () => void;
}

/**
 * Custom hook to handle camera and image gallery permissions
 * Provides methods to request permissions and check their status
 */
const useImagePermissions = (): PermissionsState => {
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [galleryPermission, setGalleryPermission] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const requestPermissions = async () => {
    setLoading(true);
    try {
      // Request camera permission
      const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
      setCameraPermission(cameraStatus === 'granted');

      // Request media library permission
      const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setGalleryPermission(mediaStatus === 'granted');
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert('Permission Error', 'Failed to request camera or gallery permissions.');
    } finally {
      setLoading(false);
    }
  };

  // Check permissions when the component mounts
  useEffect(() => {
    const checkPermissions = async () => {
      setLoading(true);
      try {
        // Check camera permission
        const cameraPermissionInfo = await Camera.getCameraPermissionsAsync();
        setCameraPermission(cameraPermissionInfo.status === 'granted');

        // Check media library permission
        const mediaLibraryPermissionInfo = await ImagePicker.getMediaLibraryPermissionsAsync();
        setGalleryPermission(mediaLibraryPermissionInfo.status === 'granted');
      } catch (error) {
        console.error('Error checking permissions:', error);
      } finally {
        setLoading(false);
      }
    };

    checkPermissions();
  }, []);

  // Function to open device settings
  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  return {
    cameraPermission,
    galleryPermission,
    loading,
    requestPermissions,
    openSettings,
  };
};

export default useImagePermissions; 