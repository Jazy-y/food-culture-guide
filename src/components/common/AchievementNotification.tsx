import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Achievement } from '../../services/achievement-service';

interface Props {
  achievement: Achievement;
  onHide: () => void;
}

const AchievementNotification: React.FC<Props> = ({ achievement, onHide }) => {
  const translateY = new Animated.Value(-100);
  const opacity = new Animated.Value(0);

  useEffect(() => {
    // Show animation
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // Hide after 3 seconds
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => onHide());
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>{achievement.icon}</Text>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Achievement Unlocked!</Text>
          <Text style={styles.achievementTitle}>{achievement.title}</Text>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    padding: 16,
    paddingTop: 50,
    backgroundColor: '#FF6B35',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  icon: {
    fontSize: 30,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
});

export default AchievementNotification;
