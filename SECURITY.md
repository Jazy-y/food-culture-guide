# Security and public repository preparation

## Credentials found during cleanup

The supplied directory contained a Firebase Admin service-account private key, a Kaggle API credential file, and hardcoded Google, Clarifai, DeepSeek, LogMeal, and OCR provider credentials. Credential values are intentionally omitted from this document.

The service-account and Kaggle files were removed from the project after a verified external backup was created. Runtime provider settings were moved to the ignored local `.env`, and the setup script no longer generates embedded credentials. Real Google key literals were also removed from historical documentation.

Before publishing, revoke or rotate the service-account key, Kaggle token, and applicable provider credentials. Removing files cannot revoke credentials or repair an earlier exposure. The private recovery backup still contains the originals and must never be uploaded to GitHub.

Firebase web configuration identifies an application; it does not authorize access to Firestore or Storage. Service-account private keys are privileged secrets. See [Firebase's security checklist](https://firebase.google.com/support/guides/security-checklist) and [API key guidance](https://firebase.google.com/docs/projects/api-keys).

## Client-side configuration

`.env` is excluded from Git, but Expo `extra` is bundled into the app. Clarifai/OCR and retained experimental provider settings remain client-readable when configured. Keep production provider secrets on a trusted server and use scoped, low-quota credentials only for private demonstrations. The legacy webpack configuration now exports only its known application settings instead of every entry in `.env`.

## Authorization status

Fixed in the portfolio-readiness pass (rules are **not deployed** automatically; deploy them to your own project and test with the Firebase emulator first):

- Users can no longer grant themselves `isAdmin`. The `users` rules reject any create or self-update that changes `isAdmin`; only an existing admin can change it.
- The hardcoded admin e-mail was removed from `firestore.rules`, from the login/auth flow (which auto-promoted that account), from the login screen's "Setup Admin" button and from the dev seed data. The unrunnable client-side `makeAdmin`/`setAdmin` scripts were deleted.
- The `admin` collection can only be written by admins.
- Unused client-exposed provider keys (Google Cloud Vision, DeepSeek, LogMeal) are no longer injected into the app bundle.
- The Express prototype no longer returns the password hash, reads its database credentials from the environment, validates input and gives one generic login error.

Still open (documented, not changed, because fixing them changes app behaviour):

- The catch-all rule lets any authenticated user read every collection, including other users' profiles.
- Subscription plans and counters are stored on the user's own document, so a user can edit them. They must not gate real payments.
- Analytics collections accept broad authenticated writes.
- Storage rules allow public reads of the whole bucket.
- Expo `extra` values (Clarifai, OCR.space, Places) are readable from the app bundle.

## Git history

There was no `.git` directory, nested Git repository, or accessible local history in the supplied project. Historical secret exposure therefore could not be assessed. If these files previously existed in another repository, scan every branch and tag there, revoke exposed credentials, and follow [GitHub's sensitive-data removal guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository). `.gitignore` does not remove previously committed files.

## Review before publication

Run `npm run check:repository`, inspect the staged file list, and verify that environment files, credential files, local dependencies, caches, and recovery archives are absent. Use a dedicated scanner against the eventual Git history as an additional check. Never upload the directory by blindly selecting every local file.
