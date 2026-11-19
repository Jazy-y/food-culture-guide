import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTensorFlow } from './TensorFlowProvider';
import { Ionicons } from '@expo/vector-icons';

interface TensorFlowLoaderProps {
  children: React.ReactNode;
}

const TensorFlowLoader: React.FC<TensorFlowLoaderProps> = ({ children }) => {
  const { isLoaded, isLoading, error, initialize } = useTensorFlow();
  const [initializationAttempted, setInitializationAttempted] = useState(false);

  useEffect(() => {
    const initializeTensorFlow = async () => {
      if (!isLoaded && !isLoading && !initializationAttempted) {
        setInitializationAttempted(true);
        await initialize();
      }
    };

    initializeTensorFlow();
  }, [isLoaded, isLoading, initialize, initializationAttempted]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.text}>Loading Food Recognition System...</Text>
        <Ionicons name="restaurant-outline" size={64} color="#FF6B35" style={styles.icon} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Ionicons name="warning" size={64} color="#FF6B35" style={styles.icon} />
        <Text style={styles.errorText}>Error loading TensorFlow: {error}</Text>
        <Text style={styles.text}>The app will continue with limited functionality.</Text>
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 20,
  },
  text: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  errorText: {
    fontSize: 18,
    color: '#FF3B30',
    textAlign: 'center',
    marginTop: 20,
  },
  icon: {
    marginTop: 20,
  }
});

export default TensorFlowLoader; 