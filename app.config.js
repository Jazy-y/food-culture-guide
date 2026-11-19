const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const baseConfig = require("./app.json");

// Expo extra is visible in the client bundle. Use restricted demo credentials;
// privileged provider calls belong on a trusted backend.
const clientVariables = [
  "FIREBASE_API_KEY", "FIREBASE_AUTH_DOMAIN", "FIREBASE_PROJECT_ID",
  "FIREBASE_STORAGE_BUCKET", "FIREBASE_MESSAGING_SENDER_ID", "FIREBASE_APP_ID",
  "CLARIFAI_PAT", "OCR_SPACE_API_KEY", "GOOGLE_CLIENT_ID",
];

module.exports = {
  ...baseConfig,
  expo: {
    ...baseConfig.expo,
    extra: {
      ...Object.fromEntries(clientVariables.map((name) => [name, process.env[name] || ""])),
      APP_ENV: process.env.APP_ENV || "development",
      API_URL: process.env.API_URL || "http://localhost:3000",
      googlePlacesApiKey: process.env.GOOGLE_PLACES_API_KEY || "",
      ...(process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {}),
    },
  },
};
