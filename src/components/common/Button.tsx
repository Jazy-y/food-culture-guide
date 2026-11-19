import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  style,
  textStyle,
  loading = false,
  disabled = false,
  variant = 'primary'
}) => {
  const getButtonStyle = () => {
    switch (variant) {
      case 'secondary':
        return styles.buttonSecondary;
      case 'outline':
        return styles.buttonOutline;
      default:
        return styles.buttonPrimary;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'secondary':
        return styles.textSecondary;
      case 'outline':
        return styles.textOutline;
      default:
        return styles.textPrimary;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        getButtonStyle(),
        disabled && styles.buttonDisabled,
        style
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator 
          color={variant === 'outline' ? '#FF6B35' : '#fff'} 
          size="small"
        />
      ) : (
        <Text style={[
          styles.text,
          getTextStyle(),
          disabled && styles.textDisabled,
          textStyle
        ]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  buttonPrimary: {
    backgroundColor: '#FF6B35',
  },
  buttonSecondary: {
    backgroundColor: '#f8f8f8',
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#FF6B35',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
  textPrimary: {
    color: '#fff',
  },
  textSecondary: {
    color: '#333',
  },
  textOutline: {
    color: '#FF6B35',
  },
  textDisabled: {
    color: '#999',
  },
});

export type { ButtonProps };
export default Button;
