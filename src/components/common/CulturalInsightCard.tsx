import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { CulturalInsight, culturalInsightsService } from '../../services/cultural-insights-service';

interface Props {
  insight: CulturalInsight;
  style?: any;
}

const CulturalInsightCard: React.FC<Props> = ({ insight, style }) => {
  const [expanded, setExpanded] = useState(false);
  const [animation] = useState(new Animated.Value(0));

  const toggleExpanded = () => {
    const toValue = expanded ? 0 : 1;
    Animated.spring(animation, {
      toValue,
      useNativeDriver: false,
      friction: 8,
      tension: 40,
    }).start();
    setExpanded(!expanded);
  };

  const maxHeight = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [100, 300],
  });

  return (
    <Animated.View style={[styles.container, { maxHeight }, style]}>
      <TouchableOpacity 
        style={styles.content}
        onPress={toggleExpanded}
        activeOpacity={0.8}
      >
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={styles.icon}>
              {culturalInsightsService.getCategoryIcon(insight.category)}
            </Text>
            <View style={styles.titleTextContainer}>
              <Text style={styles.category}>
                {culturalInsightsService.getCategoryTitle(insight.category)}
              </Text>
              <Text style={styles.title} numberOfLines={expanded ? undefined : 1}>
                {insight.title}
              </Text>
            </View>
          </View>
        </View>

        <Text 
          style={[
            styles.description,
            !expanded && styles.descriptionTruncated
          ]}
          numberOfLines={expanded ? undefined : 2}
        >
          {insight.description}
        </Text>

        {insight.source && expanded && (
          <Text style={styles.source}>Source: {insight.source}</Text>
        )}

        <View style={styles.footer}>
          <Text style={styles.expandText}>
            {expanded ? 'Show less' : 'Read more'}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 15,
    overflow: 'hidden',
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  icon: {
    fontSize: 24,
    marginRight: 12,
  },
  titleTextContainer: {
    flex: 1,
  },
  category: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  descriptionTruncated: {
    marginBottom: 8,
  },
  source: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 8,
  },
  footer: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  expandText: {
    fontSize: 12,
    color: '#FF6B35',
    fontWeight: '600',
  },
});

export default CulturalInsightCard;
