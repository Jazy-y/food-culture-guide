import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FoodData } from '../types';

interface FoodDetailsCardProps {
  food: FoodData;
  onClose?: () => void;
  onSave?: () => void;
  onRetake?: () => void;
}

const FoodDetailsCard: React.FC<FoodDetailsCardProps> = ({ 
  food, 
  onClose,
  onSave,
  onRetake
}) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.closeButton}
        onPress={onClose}
      >
        <Ionicons name="close" size={24} color="#000" />
      </TouchableOpacity>
      
      <Text style={styles.title}>Recognition Result</Text>
      
      <ScrollView style={styles.content}>
        <View style={styles.foodInfoContainer}>
          <Text style={styles.foodName}>{food.name}</Text>
          
          <View style={styles.confidenceContainer}>
            <Text style={styles.confidenceLabel}>Confidence:</Text>
            <View style={styles.confidenceBar}>
              <View
                style={[
                  styles.confidenceFill,
                  { width: `${Math.min(100, food.confidence * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.confidenceValue}>
              {`${(food.confidence * 100).toFixed(1)}%`}
            </Text>
          </View>
          
          {/* Alternative Foods Section */}
          {food.otherOptions && food.otherOptions.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Alternative Matches</Text>
              <View style={styles.alternativesContainer}>
                {food.otherOptions.map((option, index) => (
                  <View key={index} style={styles.alternativeItem}>
                    <Text style={styles.alternativeName}>{option.name}</Text>
                    <View style={styles.altConfidenceBar}>
                      <View
                        style={[
                          styles.altConfidenceFill,
                          { width: `${Math.min(100, option.confidence * 100)}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.altConfidenceValue}>
                      {`${(option.confidence * 100).toFixed(1)}%`}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          )}
          
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{food.description}</Text>
          
          <Text style={styles.sectionTitle}>Ingredients</Text>
          <View style={styles.ingredientsContainer}>
            {food.ingredients.length > 0 ? (
              food.ingredients.map((ingredient, index) => (
                <View key={index} style={styles.ingredientTag}>
                  <Text style={styles.ingredientTagText}>
                    {ingredient}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.description}>No ingredients listed</Text>
            )}
          </View>
          
          <Text style={styles.sectionTitle}>Cultural Background</Text>
          <Text style={styles.description}>{food.culturalInfo}</Text>
        </View>
      </ScrollView>
      
      {(onSave || onRetake) && (
        <View style={styles.actionButtons}>
          {onSave && (
            <TouchableOpacity 
              style={styles.saveButton} 
              onPress={onSave}
            >
              <Ionicons name="save-outline" size={18} color="#fff" />
              <Text style={styles.buttonText}>Save to Collection</Text>
            </TouchableOpacity>
          )}
          
          {onRetake && (
            <TouchableOpacity 
              style={styles.retakeButton} 
              onPress={onRetake}
            >
              <Ionicons name="camera-outline" size={18} color="#fff" />
              <Text style={styles.buttonText}>Take New Photo</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 24,
    width: '100%',
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    zIndex: 1,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 10,
    color: '#FF6B35',
  },
  content: {
    flex: 1,
  },
  foodInfoContainer: {
    padding: 24,
    paddingTop: 10,
  },
  foodName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 12,
  },
  confidenceLabel: {
    fontWeight: 'bold',
    marginRight: 10,
    color: '#555',
  },
  confidenceBar: {
    flex: 1,
    height: 10,
    backgroundColor: '#e9ecef',
    borderRadius: 5,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: '#FF6B35',
  },
  confidenceValue: {
    marginLeft: 10,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 12,
    color: '#FF6B35',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
    color: '#444',
  },
  ingredientsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  ingredientTag: {
    backgroundColor: '#f0f5ff',
    padding: 10,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e7ff',
  },
  ingredientTagText: {
    fontSize: 14,
    color: '#4062bb',
  },
  alternativesContainer: {
    marginBottom: 20,
  },
  alternativeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  alternativeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 10,
    width: 120,
  },
  altConfidenceBar: {
    flex: 1,
    height: 10,
    backgroundColor: '#e9ecef',
    borderRadius: 5,
    overflow: 'hidden',
  },
  altConfidenceFill: {
    height: '100%',
    backgroundColor: '#FF6B35',
  },
  altConfidenceValue: {
    marginLeft: 10,
    fontWeight: 'bold',
    color: '#FF6B35',
    width: 50,
    textAlign: 'right',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  retakeButton: {
    flex: 1,
    backgroundColor: '#FF6B35',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 15,
  },
});

export default FoodDetailsCard; 