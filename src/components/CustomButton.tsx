import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CustomButtonProps {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  iconColor?: string;
  iconSize?: number;
  variant?: 'primary' | 'secondary' | 'outline' | 'text';
  size?: 'small' | 'medium' | 'large';
}

export const CustomButton: React.FC<CustomButtonProps> = ({
  title,
  onPress,
  style,
  textStyle,
  loading = false,
  disabled = false,
  icon,
  iconColor = '#FFFFFF',
  iconSize = 20,
  variant = 'primary',
  size = 'medium',
}) => {
  // Determine button styles based on variant
  let buttonStyle: ViewStyle = styles.button;
  let buttonTextStyle: TextStyle = styles.buttonText;
  
  // Apply variant-specific styles
  switch (variant) {
    case 'primary':
      buttonStyle = {
        ...buttonStyle,
        backgroundColor: '#FF6B35',
      };
      break;
    case 'secondary':
      buttonStyle = {
        ...buttonStyle,
        backgroundColor: '#4062BB',
      };
      break;
    case 'outline':
      buttonStyle = {
        ...buttonStyle,
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#FF6B35',
      };
      buttonTextStyle = {
        ...buttonTextStyle,
        color: '#FF6B35',
      };
      break;
    case 'text':
      buttonStyle = {
        ...buttonStyle,
        backgroundColor: 'transparent',
        elevation: 0,
        shadowOpacity: 0,
      };
      buttonTextStyle = {
        ...buttonTextStyle,
        color: '#FF6B35',
      };
      break;
  }
  
  // Apply size-specific styles
  switch (size) {
    case 'small':
      buttonStyle = {
        ...buttonStyle,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 16,
      };
      buttonTextStyle = {
        ...buttonTextStyle,
        fontSize: 14,
      };
      break;
    case 'large':
      buttonStyle = {
        ...buttonStyle,
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 25,
      };
      buttonTextStyle = {
        ...buttonTextStyle,
        fontSize: 18,
      };
      break;
  }
  
  // Apply disabled styles
  if (disabled) {
    buttonStyle = {
      ...buttonStyle,
      opacity: 0.5,
    };
  }
  
  return (
    <TouchableOpacity
      style={[buttonStyle, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator 
          size="small" 
          color={variant === 'outline' || variant === 'text' ? '#FF6B35' : '#FFFFFF'} 
        />
      ) : (
        <View style={styles.contentContainer}>
          {icon && (
            <Ionicons 
              name={icon as any} 
              size={iconSize} 
              color={variant === 'outline' || variant === 'text' ? iconColor : '#FFFFFF'} 
              style={styles.icon} 
            />
          )}
          <Text style={[buttonTextStyle, textStyle]}>
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 8,
  },
}); 