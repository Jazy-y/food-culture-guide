# Food Culture Guide — PFE mobile application

A cross-platform mobile app, built with **React Native, Expo and TypeScript**, that helps travellers discover the food culture of the countries they visit. It was developed as my final-year engineering project (PFE).

Users can browse dishes by country, photograph a meal to identify it, translate a restaurant menu from a photo, and find restaurants nearby that serve a dish. A Firebase backend stores accounts, favourites, reviews and usage analytics. Administrators get an in-app dashboard.

> **Status:** academic project on Expo SDK 48. TypeScript, ESLint (0 errors) and Metro bundling for Android and iOS pass. Some integrations fall back to demo data on purpose (see [Known limitations](#known-limitations)).

## The problem it solves

When travelling, it is hard to know what a local dish is, what it contains, or where to try it, especially when the menu is in another language. Food Culture Guide combines four tools in one app: a food encyclopedia, food recognition from photos, menu translation and a restaurant finder.

## Features

| Area | What the code does |
| --- | --- |
| **Authentication** | Email/password sign-up and login, plus Google sign-in, using Firebase Authentication. The root navigator switches between the public stack (Welcome/Login/Register) and the app stack based on auth state. |
| **Explore dishes** | Browse countries and meals with ingredients, recipes and cultural notes from [TheMealDB](https://www.themealdb.com/api.php), plus curated cultural-insight content. |
| **Food recognition** | Take a photo or pick one from the gallery. The image is resized with `expo-image-manipulator` and sent to the **Clarifai food model**, which returns ranked predictions with confidence scores. A keyword-based fallback runs when the API is not configured. |
| **Menu translation** | Text is extracted from a photo with **OCR.space**, then translated with LibreTranslate, falling back to MyMemory. |
| **Restaurant finder** | Uses device location (`expo-location`) and the **Google Places API** to list restaurants for a dish, with map, distance sorting and filters. Sample data is used when no Places key is set. |
| **Profile** | Avatar upload (Firebase Storage), liked meals, saved translations, reviews and preferred currency. |
| **Reviews & ratings** | Users rate and review meals; reviews are stored in Firestore. |
| **Admin & analytics** | An admin tab (shown only to users whose profile has `isAdmin: true`) for managing users (grant or revoke admin rights, delete accounts) and an analytics dashboard charting usage events tracked in Firestore. |
| **Plans & achievements** | Free/basic/premium plans with usage counters, plus achievement badges. Plans are a **simulation**: there is no payment integration. |

## Tech stack

| Layer | Technology |
| --- | --- |
| Mobile | React Native 0.71, React 18, **Expo SDK 48**, TypeScript |
| Navigation | React Navigation 6 (native stacks + custom animated bottom tab bar) |
| Backend-as-a-service | Firebase Authentication, Cloud Firestore, Firebase Storage |
| Device APIs | expo-camera, expo-image-picker, expo-image-manipulator, expo-location, expo-file-system |
| External APIs | Clarifai, OCR.space, LibreTranslate, MyMemory, Google Places, TheMealDB |
| UI | react-native-svg, Reanimated, react-native-maps, react-native-chart-kit, expo-linear-gradient |
| Tooling | TypeScript, ESLint, expo-doctor |

## Architecture

```
┌─────────────────────────── Expo app (React Native) ───────────────────────────┐
│  App.tsx ─ AuthProvider ─ NavigationContainer                                   │
│     ├─ public stack:  Welcome · Login · Register                                │
│     └─ app stack:     bottom tabs (Home · Explore · Recognition · Translate ·   │
│                       Admin* · Profile) + FoodDetail · RestaurantFinder · Reviews│
│                                                                                 │
│  screens/ ──► services/ (one module per integration) ──► config/firebase.ts     │
└──────┬─────────────────────────────┬──────────────────────────────┬─────────────┘
       │ Firebase JS SDK             │ HTTPS (fetch / axios)        │ device APIs
       ▼                             ▼                              ▼
 Auth · Firestore · Storage    Clarifai · OCR.space · Places   camera · gallery · GPS
 (firestore.rules)             TheMealDB · translation APIs
```

- **No custom server:** the app talks to Firebase directly, and access control is enforced by `firestore.rules` and `storage.rules`.
- **Configuration:** `app.config.js` loads `.env` and passes the required keys to the app through `expo-constants` (`Constants.expoConfig.extra`).
- **Data model:** `users` (profile, `isAdmin`, plan), `mealReviews`, `likedMeals`, `scannedFoods`, `translations`, `feedback` and `analytics_*` collections. The PlantUML class and database diagrams are in [`docs/diagrams/`](docs/diagrams/).
- `backend/` holds an early Express + MySQL authentication prototype that the app **does not use**. It is kept for reference ([details](backend/README.md)).

## Getting started

### Prerequisites

- Node.js 18+ and npm
- A Firebase project with Email/Password authentication, Firestore and Storage enabled
- An Android emulator/device or an iOS simulator (macOS). SDK 48 needs a matching Expo Go build or a development build; current Expo Go releases no longer open SDK 48 projects.

### Install and configure

```bash
npm ci
npm run setup        # creates .env from .env.template (never overwrites an existing .env)
```

Fill in `.env`:

| Variable | Needed for | Notes |
| --- | --- | --- |
| `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID` | everything | Firebase web app config |
| `CLARIFAI_PAT` | food recognition | Clarifai personal access token |
| `OCR_SPACE_API_KEY` | menu translation | OCR.space API key |
| `GOOGLE_PLACES_API_KEY` | live restaurant search | sample data is shown without it |
| `GOOGLE_CLIENT_ID` | Google sign-in | OAuth client ID |

Deploy the security rules to **your own** Firebase project:

```bash
npx firebase-tools deploy --only firestore:rules,firestore:indexes,storage
```

To make an account an administrator, set `isAdmin: true` on its `users/{uid}` document in the Firebase console. The security rules prevent users from granting this to themselves.

### Run

```bash
npm start            # Expo dev server
npm run android      # Android emulator/device
npm run ios          # iOS simulator (macOS only)
```

### Quality checks

```bash
npm run type-check          # TypeScript
npm run lint                # ESLint
npm run check:repository    # credential / asset sanity checks
npx expo-doctor
```

## Project structure

```
├── App.tsx                  # Root: providers, navigation container, auth gate
├── app.json, app.config.js  # Expo config (.env → expo-constants)
├── src/
│   ├── App.tsx              # Root stack: public vs. authenticated screens
│   ├── navigation/          # Bottom tabs and the custom animated tab bar
│   ├── screens/             # 16 screens (Home, Explore, FoodRecognition, Translation, Profile, Admin…)
│   ├── components/          # Reusable UI (cards, modals, nearby-restaurants map, error boundary…)
│   ├── services/            # Clarifai, TheMealDB, Places, translation, analytics, subscriptions…
│   ├── contexts/, hooks/    # Auth and subscription state
│   ├── config/              # Firebase initialisation
│   ├── utils/, types/       # Helpers (currency, local storage) and shared types
│   └── assets/              # App logo
├── firestore.rules, storage.rules, firestore.indexes.json
├── scripts/                 # .env setup, repository checks, index deployment helper
├── backend/                 # Unused Express + MySQL prototype
└── docs/                    # UML diagrams, development notes, cleanup report
```

## Known limitations

- **Legacy SDK.** Expo SDK 48 targets Android API 33. Google Play requires API 34+, so a store release needs an SDK upgrade (expo-doctor flags this).
- **Client-side API keys.** Values in `extra` are bundled into the app and can be extracted. Use restricted, low-quota keys; a production version should call Clarifai, OCR.space and Places through a server.
- **Simulated plans.** Plans and usage counters are stored on the user's own document and enforced only in the client.
- **Broad reads.** The Firestore rules still let any signed-in user read most collections, including other users' profiles. Admin self-escalation is blocked.
- **Fallback data.** Without API keys, recognition and the restaurant finder fall back to keyword matching and sample data. Currency conversion uses fixed demo rates.
- **Session persistence.** Firebase Auth is initialised with `getAuth` and no AsyncStorage persistence, so users may need to sign in again after restarting the app.
- **No automated tests yet,** and `npm run web` is not supported (the web dependencies are not installed).

The security review is in [SECURITY.md](SECURITY.md) and the cleanup history in [docs/CLEANUP-REPORT.md](docs/CLEANUP-REPORT.md).

## Author

[@Jazy-y](https://github.com/Jazy-y) — final-year project (PFE).
