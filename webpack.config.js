const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const webpack = require('webpack');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
const env = dotenv.config({ path: path.resolve(__dirname, '.env') }).parsed || {};

// Convert environment variables to strings
// Only expose settings consumed by legacy web modules, not every .env entry.
const envKeys = ['APP_ENV', 'API_URL'].reduce((prev, next) => {
  prev[`process.env.${next}`] = JSON.stringify(env[next]);
  return prev;
}, {});

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync({
    ...env,
    babel: {
      dangerouslyAddModulePathsToTranspile: ['@expo/vector-icons']
    }
  }, argv);

  // Add environment variables
  config.plugins.push(new webpack.DefinePlugin(envKeys));

  // Add fallbacks for node modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    crypto: false,
    stream: false,
    buffer: false
  };

  return config;
};
