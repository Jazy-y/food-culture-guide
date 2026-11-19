import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { Ionicons } from '@expo/vector-icons';
import { culturalInsightsService, CulturalInsight } from '../services/cultural-insights-service';
import CulturalInsightCard from '../components/common/CulturalInsightCard';

type Props = NativeStackScreenProps<RootStackParamList, 'CulturalInsights'>;

type Category = CulturalInsight['category'];

const CulturalInsightsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { country } = route.params;
  const [insights, setInsights] = useState<CulturalInsight[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInsights();
  }, [country]);

  const loadInsights = () => {
    const countryInsights = culturalInsightsService.getInsightsByCountry(country);
    setInsights(countryInsights);
    setLoading(false);
  };

  const categories: Category[] = ['history', 'tradition', 'etiquette', 'ingredients', 'preparation'];

  const filteredInsights = selectedCategory === 'all' 
    ? insights 
    : insights.filter(insight => insight.category === selectedCategory);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>{country} Culture</Text>
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        <TouchableOpacity
          style={[
            styles.categoryButton,
            selectedCategory === 'all' && styles.categoryButtonActive
          ]}
          onPress={() => setSelectedCategory('all')}
        >
          <Text style={[
            styles.categoryText,
            selectedCategory === 'all' && styles.categoryTextActive
          ]}>
            All
          </Text>
        </TouchableOpacity>

        {categories.map((category) => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryButton,
              selectedCategory === category && styles.categoryButtonActive
            ]}
            onPress={() => setSelectedCategory(category)}
          >
            <Text style={styles.categoryIcon}>
              {culturalInsightsService.getCategoryIcon(category)}
            </Text>
            <Text style={[
              styles.categoryText,
              selectedCategory === category && styles.categoryTextActive
            ]}>
              {culturalInsightsService.getCategoryTitle(category)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      ) : (
        <ScrollView 
          style={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {filteredInsights.length > 0 ? (
            filteredInsights.map((insight) => (
              <CulturalInsightCard
                key={insight.id}
                insight={insight}
              />
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No insights available for this category yet.
              </Text>
            </View>
          )}
          <View style={styles.bottomPadding} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  categoriesContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  categoriesContent: {
    padding: 15,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f8f8f8',
    marginRight: 12,
  },
  categoryButtonActive: {
    backgroundColor: '#FF6B35',
  },
  categoryIcon: {
    marginRight: 8,
    fontSize: 16,
  },
  categoryText: {
    fontSize: 14,
    color: '#666',
  },
  categoryTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  bottomPadding: {
    height: 20,
  },
});

export default CulturalInsightsScreen;
