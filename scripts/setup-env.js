const fs = require("fs");
const path = require("path");
const envPath = path.resolve(__dirname, "../.env");
const templatePath = path.resolve(__dirname, "../.env.template");

if (fs.existsSync(envPath)) {
  console.log("Existing .env preserved. Compare it with .env.template for new settings.");
} else {
  fs.copyFileSync(templatePath, envPath, fs.constants.COPYFILE_EXCL);
  console.log("Created .env from .env.template. Add your own configuration before starting Expo.");
}
