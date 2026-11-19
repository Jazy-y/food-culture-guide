module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:react-native/all',
  ],
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
    'react-native'
  ],
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  env: {
    'react-native/react-native': true,
    jest: true,
  },
  rules: {
    // TypeScript specific rules
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    // Unused locals/styles are reported as warnings: remaining ones are
    // documented technical debt in large legacy screens.
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

    // React specific rules
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // React Native specific rules
    // Stylistic rules from plugin:react-native/all that do not affect
    // behaviour: alphabetical style keys and colour literals (the app keeps
    // colours inline in StyleSheet objects).
    'react-native/sort-styles': 'off',
    'react-native/no-color-literals': 'off',
    'react-native/no-unused-styles': 'warn',
    'react-native/split-platform-components': 'error',
    'react-native/no-inline-styles': 'warn',
    'react-native/no-raw-text': ['error', { skip: ['Button', 'SafeText'] }],

    '@typescript-eslint/no-empty-function': ['error', { allow: ['arrowFunctions', 'private-constructors'] }],

    // General rules
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': ['error', 'always'],
  },
  overrides: [
    {
      // Node.js tooling and the standalone Express prototype use CommonJS.
      files: ['scripts/**/*.js', 'backend/**/*.js'],
      env: { node: true },
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        'no-console': 'off',
      },
    },
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
  ignorePatterns: [
    'node_modules/',
    'babel.config.js',
    'metro.config.js',
    '*.config.js',
  ],
};
