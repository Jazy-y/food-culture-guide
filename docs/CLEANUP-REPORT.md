# Food Culture Guide — repository cleanup

Completed on 19 November 2026. This cleanup prepares the academic source tree for review. A working application build and production security have not been verified.

## Recovery

A private recovery ZIP exists outside this project. All 1,444 archived files matched the SHA-256 manifest, and the ZIP integrity check passed. The archive includes original credentials and must never be uploaded.

No `.git` directory exists here. No commits, pushes, remote changes, Firebase deployments, or credential revocations were performed. Prior Git history could not be assessed.

## Removed files

| Files | Reason |
| --- | --- |
| `.expo/` and `.idea/` contents | Local Expo state and IDE files |
| `firestore-debug.log` | Empty generated log |
| `package.json.bak`, `package.json.new` | Old copies; active manifest and lockfile retained |
| `respond.txt`, `app_context.txt` | Old assistant/debug context |
| Root `logo.png` | Duplicate of `src/assets/logo.png` |
| `src/assets/1.tflite` | Duplicate of retained `assets/models/1.tflite` |
| `src/assets/kaggle.json`, root Firebase Admin SDK credential JSON | Privileged credentials removed from the publishable project |
| `src/utils/modelLoader.ts` | Unreferenced experimental loader |
| `src/screens/TestScreen.tsx`, `src/utils/testApi.ts` | Unreferenced development probes |
| `assets/model/` | Unreferenced experimental configuration and 58-byte placeholder weight shards |
| `assets/icon.png`, `assets/splash.png`, `assets/images/tunisian-food-bg.jpg` | Zero-byte images; Expo assets now reference the retained logo |
| Both `patches/*.patch` files | Inactive old Expo patches; no patch-package install hook; modules-core version differs from the lockfile |
| `app.entry.js`, `index.js` | Unreferenced alternate entry points. The configured Expo entry point loads root `App.tsx` |

The original cleanup log records 30 removed files. The final pass removed the two alternate entry points and empty temporary directories. No active screen was intentionally removed.

## Organization and configuration

- Moved two PlantUML diagrams to `docs/diagrams/` and seven historical guides/examples to `docs/development/`.
- Rewrote the README to describe actual features, setup, simulated behavior, and compatibility limits.
- Moved provider credential literals from source to ignored local `.env` settings, and sanitized historical credential examples.
- Replaced credential-generating setup code with a template copy that preserves an existing `.env`.
- Added `.firebaserc.example`, `.gitattributes`, and ignore rules for credentials, local settings, dependencies, build output, and backups.
- Removed embedded EAS/credential configuration from public app configuration. Restricted legacy webpack environment exports to the settings used there.
- Kept Reanimated's Babel plugin last. Preserved dependency versions and lockfiles.
- Added the dependency-free `check:repository` script. Its checks cover common credential literals/files, tracked private files, root manifest/lockfile agreement, and configured Expo asset existence/size.
- Clarified that `setup-model.js` is an optional experimental model size check, not an inference test or a requirement for the main Clarifai flow.

Client-bundled environment settings are readable by app users. `.env` avoids committing a token but does not make it confidential in a mobile app. See [SECURITY.md](../SECURITY.md).

## Retained deliberately

| Item | Reason |
| --- | --- |
| Application screens, navigation, components, hooks, contexts, and services | Preserve academic implementation and behavior |
| Both subscription service implementations | Existing imports use both; they are not interchangeable duplicates |
| Recognition experiments, labels, and one TFLite model | Preserve project work without claiming verified inference or accuracy |
| `backend/` | Earlier Express/MySQL prototype, separate from the Firebase app |
| Local `.env` and `.firebaserc` | Private development configuration, excluded by Git ignore rules |
| Lockfiles, rules, indexes, diagrams, historical notes | Reproducibility and academic context |

Third-party model and asset redistribution rights still need confirmation. No project-wide open-source license was invented.

## Verification

| Check | Result |
| --- | --- |
| Recovery ZIP and hashes | Passed for 1,444 original archived files |
| Repository checker | Passed |
| Static relative import/file audit | Passed with no missing relative targets after cleanup; does not check export types or runtime compatibility |
| Original API credential comparison | No matches in scanned publishable text files; ignored private settings and installed dependencies excluded |
| Dependency installation | Blocked: the earlier npm attempt failed with registry `EACCES` errors; its empty root `node_modules` tree was removed |
| TypeScript and ESLint | Not completed: packages/executables are missing; ordinary npm invocations also encountered a host filesystem `EPERM` error |
| Device run, native build, navigation, external API calls | Not verified |

The dependency-free check ran with this host-specific command:

```powershell
node --preserve-symlinks --preserve-symlinks-main scripts/check-repository.js
```

On a normal local installation, use `npm run check:repository`. After installing dependencies successfully, run `npm run type-check`, `npm run lint`, and validate on a compatible device/client.

## Remaining work

1. Revoke or rotate the original Firebase Admin, Kaggle, and provider credentials. Deleting files does not revoke credentials.
2. Correct and test authorization before using real data: broad authenticated Firestore access, client-writable admin flags, email-specific admin promotion, and development admin helpers remain. Details are in the security report.
3. Align the legacy Expo SDK 48 dependency tree. Recorded TensorFlow React Native peer ranges conflict with the app stack; the optional web target lacks required web dependencies.
4. Resolve existing source/API mismatches after TypeScript can run. For example, `src/components/FoodRecognition.tsx` imports named Clarifai exports while the service exposes a default class. Consolidating subscription implementations requires a separate functional change.
5. Replace simulated recognition/restaurant fallbacks, fixed exchange rates, and client-managed subscription entitlements where real functionality is needed.
6. Treat the MySQL prototype as unfinished: its schema is absent, connection defaults use root with an empty password, and login returns the stored password hash inside the user record.
7. Confirm third-party redistribution rights, review the initial Git file selection, rerun the repository checker, and scan eventual Git history with a dedicated secret scanner.


---

## Second pass: portfolio readiness (19 November 2026)

A pre-change copy of the tree (without `node_modules`, `.env` and `.firebaserc`) was kept for comparison while this pass was made.

### Bugs fixed

| Problem | Fix |
| --- | --- |
| `src/services/restaurant-service.ts` had double-encoded (mojibake) Greek identifiers in both distance formulas, so TypeScript and Metro could not parse the file | Renamed to `phi1`, `phi2`, `deltaPhi`, `deltaLambda`; repaired `Café` strings |
| `simple-recognition-service.ts` declared `foodDatabase` twice (array and record). At runtime the record replaced the array, so `for…of`/`.find` on it threw | Kept the record and derived the searchable list from it |
| Root stack route `RestaurantFinder` rendered `FoodDetailScreen` | Now renders `RestaurantFinderScreen` |
| iOS location permission text was missing although `expo-location` is used | Added the `expo-location` plugin and `NSLocationWhenInUseUsageDescription`; Android now requests location permissions instead of the unused storage permissions |
| App icon was 499×500 (expo-doctor schema error) | Padded to 500×500 with a transparent column |
| `tensorflow-food-recognition-service.ts` type error (`never`) | Typed the best-match variable |

### Security

See [SECURITY.md](../SECURITY.md#authorization-status): admin self-escalation blocked in rules, every hardcoded admin e-mail removed, admin helper scripts and the "Setup Admin" button deleted, unused provider keys no longer bundled, and the prototype backend hardened.

### Removed in this pass (none were imported by the running app)

Reachability was computed from `App.tsx` by following every relative `import`/`require`. The files below were not reachable, and `tsc` plus a full Metro export were run after removal.

| Files | Reason |
| --- | --- |
| `src/screens/AchievementsScreen.tsx`, `AdminScreen.tsx`, `CameraScreen.tsx`, `SearchScreen.tsx` | Not registered in any navigator |
| `src/components/AdminDashboard.tsx`, `AdminOverlayModal.tsx`, `AdminSetupButton.tsx`, `CustomTabBar.tsx` (duplicate of `navigation/CustomTabBar.tsx`), `FoodRecognition.tsx`, `SubscriptionCard.tsx` | Unused; `AdminSetupButton` wrote an admin flag from the client |
| `src/services/ai.ts`, `ai-service.ts`, `deepseek-vision-service.ts`, `enhanced-recognition-service.ts`, `food-recognition-service.ts`, `logmeal-service.ts`, `mobilenet-recognition-service.ts`, `tensorflow-service.ts`, `vision-web.ts`, `location.ts`, `user-service.ts`, `SubscriptionService.ts` | Unused recognition experiments and duplicate services |
| `src/utils/adminUtils.ts`, `clearStorage.ts`, `font-loader.ts`, `modelMapper.js`, `tensorflow-polyfill.ts`; `src/hooks/useSubscription.ts`; `src/config/env.ts`, `initializeFirestore.js`; `src/platform/web.ts`; `src/polyfills.ts`; `src/types/index.d.ts` (ambient modules nobody imported) | Unused |
| `src/scripts/makeAdmin.ts`, `setAdmin.ts`, `createRestaurantCollection.ts` | Client-SDK scripts with hardcoded e-mails that cannot run outside the Expo runtime |
| `assets/models/1.tflite` (21 MB), `src/assets/labels.txt`, `scripts/setup-model.js` | Model only used by the removed TensorFlow experiments; it was also bundled into the app by the `**/*` asset pattern |
| `react-native.config.js` | Only configured the removed `react-native-vector-icons` package (`@expo/vector-icons` is used) |
| `setUserAsAdmin` in `src/config/firebase.ts` and the unused admin handlers in `ProfileScreen.tsx` | Dead code |

### Dependencies removed

`@emotion/react`, `@emotion/styled`, `@mui/material` (web UI libraries), `@react-native-firebase/app`, `@react-native-firebase/auth` (the app uses the Firebase JS SDK), `@tensorflow/tfjs`, `@tensorflow/tfjs-react-native`, `@tensorflow-models/mobilenet`, `clarifai` (the REST API is called with `fetch`), `expo-gl`, `expo-media-library`, `react-native-blob-util`, `react-native-fs`, `react-native-vector-icons`, `patch-package`, `@types/react-native` (React Native 0.71 ships its own types). Removing the TensorFlow packages resolved the peer-dependency conflict: `npm ci` no longer needs `--legacy-peer-deps`.

### Tooling

- ESLint: the stylistic `react-native/sort-styles` and `react-native/no-color-literals` rules are off. Unused variables and styles are reported as warnings (remaining technical debt in large screens). Node.js scripts and `backend/` have a CommonJS override. `SafeText` is treated as a text component.
- Mechanical lint fixes: unused imports, escaped JSX apostrophes, redundant `try/catch` rethrows, a dead `if (… && false)` branch.

### Verification (this pass)

| Check | Result |
| --- | --- |
| `npm ci` (Node 22, no flags) | Passed |
| `npm run type-check` | Passed, 0 errors (36 before) |
| `npm run lint` | 0 errors, ~470 warnings (1,008 errors before) |
| `npx expo config` | Passed |
| `npx expo-doctor` | 15/16; remaining: SDK 48 targets Android API 33 (store submission needs an SDK upgrade) |
| `npx expo export --platform all` (Metro, Android + iOS bundles) | Passed |
| `npm run check:repository` | Passed |
| Firestore rules compile/emulator test | **Not run** (no Firebase CLI/emulator in this environment) |
| Running on a device/simulator, native builds | **Not run** (no Android SDK/Xcode session used) |
