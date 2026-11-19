import React from 'react';
import { View, TextInput as RNTextInput, StyleSheet, TextInputProps, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props extends TextInputProps {
  leftIcon?: keyof typeof Ionicons.glyphMap;
  error?: string;
}

const TextInput: React.FC<Props> = ({ leftIcon, error, style, ...props }) => {
  return (
    <View style={styles.container}>
      <View style={[
        styles.inputContainer,
        error ? styles.inputContainerError : null,
        style
      ]}>
        {leftIcon && (
          <Ionicons 
            name={leftIcon} 
            size={20} 
            color="#666" 
            style={styles.icon}
          />
        )}
        <RNTextInput
          style={[
            styles.input,
            leftIcon ? styles.inputWithIcon : null
          ]}
          placeholderTextColor="#999"
          {...props}
        />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    paddingHorizontal: 16,
    height: 50,
  },
  inputContainerError: {
    borderColor: '#ff4444',
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  inputWithIcon: {
    paddingLeft: 0,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 16,
  },
});

export default TextInput;
