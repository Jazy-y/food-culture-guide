/* Dependency-free checks for files intended for the public repository.
 * This catches common mistakes; it is not a complete secret-scanning service.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const skippedDirectories = new Set([
  "node_modules", ".git", ".expo", ".idea", ".vscode", ".firebase",
  "dist", "build", "web-build", "coverage", "tmp", "temp", "backups",
]);
const isPrivate = (name) =>
  /^\.env(?:\.|$)/.test(path.basename(name)) &&
  ![".env.template", ".env.example"].includes(path.basename(name));
const credentialFile = (name) =>
  /(?:firebase-adminsdk|service-account|serviceAccount).*\.json$/i.test(name) ||
  /^(?:(?:kaggle|credentials|google-services)\.json|GoogleService-Info\.plist)$/i.test(path.basename(name)) ||
  /\.(?:pem|key|p8|p12|pfx|jks|keystore|mobileprovision)$/i.test(name);
const problems = [];
let scanned = 0;

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    const relative = path.relative(root, fullPath).replace(/\\/g, "/");
    if (entry.isSymbolicLink()) {
      problems.push(`${relative}: review symbolic link before publication`);
    } else if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name)) visit(fullPath);
    } else if (credentialFile(relative)) {
      problems.push(`${relative}: credential file must be stored outside the repository`);
    } else if (!isPrivate(relative) && /\.(?:[jt]sx?|json|md|txt|rules|puml)$/.test(relative)) {
      scanned += 1;
      const text = fs.readFileSync(fullPath, "utf8");
      if (/AIza[\w-]{30,}|sk-[\w-]{20,}|-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(text)) {
        problems.push(`${relative}: possible credential literal (value withheld)`);
      }
      const assignedSecrets = /(?:\bPAT\b|\w*(?:API_KEY|apiKey|PASSWORD|password|SECRET|secret))\s*[:=]\s*["']([^"'\r\n]{8,})["']/g;
      for (const match of text.matchAll(assignedSecrets)) {
        if (!/^(?:your[_-]|YOUR[_-]|example|placeholder)/.test(match[1])) {
          problems.push(`${relative}: possible hardcoded secret (value withheld)`);
        }
      }
    }
  }
}

visit(root);
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
for (const section of ["dependencies", "devDependencies"]) {
  const sorted = (value) => JSON.stringify(Object.entries(value || {}).sort());
  if (sorted(pkg[section]) !== sorted(lock.packages[""][section])) {
    problems.push(`package-lock.json: ${section} differ from package.json`);
  }
}

const app = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8")).expo;
for (const asset of [app.icon, app.splash.image, app.android.adaptiveIcon.foregroundImage, app.web.favicon]) {
  const fullPath = path.resolve(root, asset);
  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).size === 0) {
    problems.push(`app.json: missing or empty asset ${asset}`);
  }
}

if (fs.existsSync(path.join(root, ".git"))) {
  try {
    const tracked = execFileSync("git", ["-C", root, "ls-files", "-z"], { encoding: "utf8" }).split("\0");
    for (const name of tracked) {
      if (isPrivate(name) || path.basename(name) === ".firebaserc" || credentialFile(name) || name.split("/").includes("node_modules")) {
        problems.push(`${name}: private or generated file is tracked by Git`);
      }
    }
  } catch {
    problems.push("Unable to inspect tracked Git files");
  }
} else {
  console.log("No .git history exists here. Re-run this check after initializing your repository.");
}

if (problems.length) {
  problems.forEach((problem) => console.error(problem));
  process.exitCode = 1;
} else {
  console.log(`Repository checks passed (${scanned} text files, lockfile metadata, configured assets).`);
}
