const { getDefaultConfig } = require("@expo/metro-config");

const config = getDefaultConfig(__dirname);

// Add any custom configuration here
config.resolver.sourceExts = [
  ...config.resolver.sourceExts,
  "mjs",
  "cjs",
  "js",
  "jsx",
  "ts",
  "tsx",
  "json",
];

// Add SVG transformer
config.transformer.babelTransformerPath = require.resolve(
  "react-native-svg-transformer"
);
config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== "svg"
);
config.resolver.sourceExts = [...config.resolver.sourceExts, "svg"];

// Add support for TensorFlow.js model files
config.resolver.assetExts = [
  ...config.resolver.assetExts,
  "tflite",
  "bin",
  "model",
  "pb",
  "lite"
];

// Increase max workers for better performance with TensorFlow
config.maxWorkers = 4;

// Increase RAM limit to prevent out of memory errors
config.transformer.minifierConfig = {
  ...config.transformer.minifierConfig,
  ram: 4096, // 4GB RAM limit
};

module.exports = config;
