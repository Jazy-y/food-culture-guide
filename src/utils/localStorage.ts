import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Clears all locally stored data
 * Used primarily in development mode to ensure clean state
 */
export const clearLocalStorage = async (): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    if (keys.length > 0) {
      await AsyncStorage.multiRemove(keys);
      console.log("Local storage cleared successfully");
    }
  } catch (error) {
    console.error("Error clearing local storage:", error);
  }
};

export const getItem = async (key: string): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(key);
  } catch (error) {
    console.error(`Error getting item ${key}:`, error);
    return null;
  }
};

export const setItem = async (key: string, value: string): Promise<boolean> => {
  try {
    await AsyncStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error(`Error setting item ${key}:`, error);
    return false;
  }
};
