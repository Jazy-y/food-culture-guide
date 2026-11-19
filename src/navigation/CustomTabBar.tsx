import React, { useEffect, useRef } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import Svg, { Path, Circle, LinearGradient, Stop } from "react-native-svg";
import { useAuth } from '../contexts/AuthContext';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';

// Define a type for Ionicons names we're using
type IoniconName = 
  | "home" 
  | "home-outline" 
  | "compass" 
  | "compass-outline" 
  | "camera" 
  | "camera-outline" 
  | "language" 
  | "language-outline" 
  | "person" 
  | "person-outline" 
  | "shield-checkmark" 
  | "shield-outline"
  | "help-outline";

const { width } = Dimensions.get("window");

const AnimatedSvg = Animated.createAnimatedComponent(Svg);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type TabButtonProps = {
  label: string;
  accessibilityLabel: string;
  icon: IoniconName;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  tabWidth: number;
  isCamera?: boolean;
};

const TabButton = ({
  label,
  accessibilityLabel,
  icon,
  isFocused,
  onPress,
  onLongPress,
  tabWidth,
  isCamera = false,
}: TabButtonProps) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isFocused) {
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(animatedValue, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }

    // Add pulsing animation for camera button
    if (isCamera) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [isFocused, animatedValue, isCamera, pulseAnim]);

  // Limit the translateY animation to prevent icons from floating too high
  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, isCamera ? -5 : -4],
    extrapolate: 'clamp',
  });

  const scale = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, isCamera ? 1.1 : 1.12],
    extrapolate: 'clamp',
  });

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
    extrapolate: 'clamp',
  });

  const textOpacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const textTranslateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
    extrapolate: 'clamp',
  });

  if (isCamera) {
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        onLongPress={onLongPress}
        style={[styles.tabButton, styles.cameraButton]}
        activeOpacity={0.8}
      >
        <Animated.View
          style={[
            styles.cameraButtonContent,
            {
              transform: [
                { translateY },
                { scale: Animated.multiply(scale, pulseAnim) },
              ],
            },
          ]}
        >
          <ExpoLinearGradient
            colors={['#FF6B6B', '#FF4757']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cameraIconContainer}
          >
            <Ionicons name="camera" size={30} color="#FFFFFF" />
          </ExpoLinearGradient>
        </Animated.View>
        <Animated.Text
          style={[
            styles.tabButtonText,
            {
              opacity: textOpacity,
              transform: [{ translateY: textTranslateY }],
              color: isFocused ? '#FF4757' : '#8E8E8E',
              marginTop: 2,
            },
          ]}
          numberOfLines={1}
        >
          {label}
        </Animated.Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabButton}
      activeOpacity={0.8}
    >
      <Animated.View
        style={[
          styles.tabButtonContent,
          {
            transform: [
              { translateY },
              { scale },
            ],
            opacity,
            width: tabWidth,
          },
        ]}
      >
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={22} color={isFocused ? '#FF4757' : '#8E8E8E'} />
        </View>
        <Animated.Text
          style={[
            styles.tabButtonText,
            {
              opacity: textOpacity,
              transform: [{ translateY: textTranslateY }],
              color: isFocused ? '#FF4757' : '#8E8E8E',
              marginTop: 1,
            },
          ]}
          numberOfLines={1}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

const CustomTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const { user, userData } = useAuth();
  const insets = useSafeAreaInsets();
  
  // Filter tabs based on user role before creating animation values
  const filteredState = {
    ...state,
    routes: state.routes.filter((route) => {
      // Keep all tabs except for conditional ones
      return true;
    }),
  };
  
  // Get the number of tabs to show
  const visibleRoutes = filteredState.routes;
  
  // Create animation values AFTER filtering routes
  const animatedValues = useRef(
    visibleRoutes.map(() => new Animated.Value(0))
  ).current;

  const numTabs = visibleRoutes.length;
  
  // Calculate tab width
  const tabWidth = width / numTabs;

  // Animation value for path translation
  const xOffset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // When the selected tab changes, animate the background path
    Animated.timing(xOffset, {
      toValue: filteredState.index * tabWidth,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [filteredState.index, tabWidth, xOffset]);

  // Generate scale animations when tab focus changes
  useEffect(() => {
    Animated.parallel(
      animatedValues.map((anim, index) =>
        Animated.timing(anim, {
          toValue: index === filteredState.index ? 1 : 0,
          duration: 250,
          useNativeDriver: true,
        })
      )
    ).start();
  }, [filteredState.index, animatedValues]);

  const getIconName = (routeName: string, isFocused: boolean): IoniconName => {
    let iconName: IoniconName = "help-outline";
    switch (routeName) {
      case "HomeTab":
        iconName = isFocused ? "home" : "home-outline";
        break;
      case "ExploreTab":
        iconName = isFocused ? "compass" : "compass-outline";
        break;
      case "FoodRecognitionTab":
        iconName = isFocused ? "camera" : "camera-outline";
        break;
      case "TranslationTab":
        iconName = isFocused ? "language" : "language-outline";
        break;
      case "ProfileTab":
        iconName = isFocused ? "person" : "person-outline";
        break;
      case "AdminTab":
        iconName = isFocused ? "shield-checkmark" : "shield-outline";
        break;
    }
    return iconName;
  };

  const getLabel = (routeName: string) => {
    switch (routeName) {
      case "HomeTab":
        return "Home";
      case "ExploreTab":
        return "Explore";
      case "FoodRecognitionTab":
        return "Scan";
      case "TranslationTab":
        return "Translate";
      case "ProfileTab":
        return "Profile";
      default:
        return routeName;
    }
  };

  // Define the SVG path for the more curved background
  const curveHeight = 13; // Further reduced curve height
  const tabBarHeight = 50 + insets.bottom; // Further reduced tabbar height
  const svgHeight = tabBarHeight + curveHeight;
  
  // Calculate the curved path with more balanced curve
  const centerX = width / 2;
  
  // More gentle curved path
  const curvePath = `
    M0,${curveHeight} 
    C${width * 0.15},${curveHeight} ${width * 0.3},0 ${centerX},0 
    C${width * 0.7},0 ${width * 0.85},${curveHeight} ${width},${curveHeight} 
    L${width},${svgHeight} 
    L0,${svgHeight} 
    Z
  `;

  // Find the camera tab index for proper centering
  const cameraTabIndex = visibleRoutes.findIndex(
    route => route.name === "FoodRecognitionTab"
  );
  
  // Calculate the center position for proper alignment
  const centerPosition = (numTabs - 1) / 2;
  const adjustedCenterPosition = Math.floor(centerPosition);

  return (
    <>
      <View style={[styles.container, { height: tabBarHeight + curveHeight }]}>
        <Svg
          width={width}
          height={svgHeight}
          style={StyleSheet.absoluteFill}
        >
          <Path
            d={curvePath}
            fill="#FFFFFF"
            stroke="rgba(0,0,0,0.08)"
            strokeWidth={1}
          />
          <LinearGradient id="tabBarGradient" x1="0" y1="0" x2="0" y2="100%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
            <Stop offset="1" stopColor="#F8F8F8" stopOpacity="1" />
          </LinearGradient>
        </Svg>

        {/* Add highlight shadow to the tab bar */}
        <View style={styles.tabBarShadow} />

        {/* Create a curve-matching container for the tabs */}
        <View style={styles.tabsContainer}>
          {visibleRoutes.map((route, index) => {
            const isFocused = filteredState.index === index;
            const isCamera = route.name === "FoodRecognitionTab";
            
            // Position each tab according to the tab width and curve
            const tabPosition = index * (width / numTabs);
            const tabPositionCenter = tabPosition + (width / numTabs) / 2;
            
            // Whether this tab should be centered in the tab bar
            const isCenter = isCamera || (cameraTabIndex === -1 && index === adjustedCenterPosition);
            
            // Calculate the Y offset following the curve
            // This helps position icons along the curved navbar
            let yOffset = 0;
            if (!isCenter) {
              // Don't apply curve to the camera or center icon since they're floating
              // For other icons, calculate a position that follows the curve
              const distanceFromCenter = Math.abs(tabPositionCenter - centerX);
              const curveRatio = distanceFromCenter / (width / 2);
              yOffset = curveRatio * curveHeight * 0.5; // Scale factor to make the effect subtle
            }
            
            // Animation values - added null check
            const animValue = animatedValues[index];
            const scale = animValue ? animValue.interpolate({
              inputRange: [0, 1],
              outputRange: [1, isCamera ? 1.3 : 1.1],
            }) : new Animated.Value(1);
            
            const opacity = animValue ? animValue.interpolate({
              inputRange: [0, 1],
              outputRange: [0.7, 1],
            }) : new Animated.Value(0.7);

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            return (
              <View 
                key={route.key} 
                style={[
                  styles.tabButtonWrapper,
                  { 
                    transform: [{ translateY: yOffset }]
                  }
                ]}
              >
                <TabButton
                  label={getLabel(route.name)}
                  accessibilityLabel={getLabel(route.name)}
                  icon={getIconName(route.name, isFocused)}
                  isFocused={isFocused}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  tabWidth={tabWidth}
                  isCamera={isCamera}
                />
              </View>
            );
          })}
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "transparent",
    zIndex: 999,
  },
  tabBarShadow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -6,
    },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 20,
  },
  tabsContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-around",
    height: "100%",
    paddingBottom: 6, // Reduced padding
    paddingTop: 10, // Adjusted for lower icons
  },
  tabButtonWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    height: "100%",
  },
  tabButtonContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    width: 34, // Smaller icons
    height: 34, // Smaller icons
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  tabButtonText: {
    fontSize: 9, // Smaller text
    color: "#666666",
    marginTop: 1, // Reduced margin between icon and text
    fontWeight: "600",
    textShadowColor: 'rgba(255, 255, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0.5 },
    textShadowRadius: 1,
  },
  cameraButton: {
    marginTop: -30, // Increased lift for camera button to position it higher
  },
  cameraButtonContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  cameraIconContainer: {
    width: 56, // Bigger camera button
    height: 56, // Bigger camera button
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 12,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
});

export default CustomTabBar;
