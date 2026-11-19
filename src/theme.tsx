import React, { createContext, useContext, ReactNode } from "react";

export const theme = {
  colors: {
    primary: "#FF6B35",
    secondary: "#4ECDC4",
    background: "#FFF8F5",
    text: "#333333",
    error: "#FF3B30",
    success: "#34C759",
    textLight: "#8A8A8F",
    card: "#FFFFFF",
    shadow: "#000000",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
  },
};

type ThemeType = typeof theme;

const ThemeContext = createContext<ThemeType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
