# Auth Status

## What's built

Sign in with Apple and Google Sign-In are integrated as a **local identity layer** — no backend, no Supabase. The user's ID, email, and name are stored in AsyncStorage only. This establishes identity for future iCloud / Google Drive backup without any network calls today.

### Files

| File | Purpose |
|---|---|
| `src/context/AuthContext.tsx` | React context with `signInWithApple`, `signInWithGoogle`, `continueAsGuest`, `signOut`. Reads/writes `@auth_identity` from AsyncStorage. |
| `app/login.tsx` | Clean login screen with Apple, Google, and "Continue without account" options. |
| `app/_layout.tsx` | Wraps app in `AuthProvider`. Routes to `/login` on first launch or after sign-out; routes to `/(tabs)` when identity exists. |
| `app/(tabs)/_layout.tsx` | Adds a `person-circle-outline` icon to the Dashboard header. Tapping it shows an alert with the account name/email and a **Sign Out** option. |

### Packages added

```
expo-apple-authentication   ~8.0.8
@react-native-google-signin/google-signin  ^16.1.2
```

Both are registered as Expo plugins in `app.json`.

## What still needs configuration

### Google Sign-In (required before it works)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
3. Create two client IDs:
   - **Web application** — copy the Client ID (looks like `123456789-abc...apps.googleusercontent.com`)
   - **iOS** — use your bundle ID (`com.yourcompany.tradejournal`); note the **Reversed Client ID** (looks like `com.googleusercontent.apps.123456789-abc...`)
4. In `src/context/AuthContext.tsx`, replace:
   ```ts
   const GOOGLE_WEB_CLIENT_ID = 'REPLACE_WITH_YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';
   ```
5. In `app.json`, replace `iosUrlScheme`:
   ```json
   "iosUrlScheme": "com.googleusercontent.apps.REPLACE_WITH_YOUR_REVERSED_CLIENT_ID"
   ```
6. Run `npx expo prebuild` and rebuild the native app.

### Sign in with Apple

Works automatically on iOS simulator/device once the app is built with a development build. No extra config needed beyond the `expo-apple-authentication` plugin already in `app.json`.

Requires **Apple Developer account** and the **Sign in with Apple** capability enabled in your App ID.

## Behavior notes

- **Sign-out** only removes the stored identity (`@auth_identity`). All trade data in SQLite is untouched.
- Apple only returns full name on the **first** sign-in. Subsequent sign-ins return only the opaque user ID. The name is preserved from the first sign-in via AsyncStorage.
- "Continue without account" stores `{ userId: 'guest', provider: 'guest' }` — the user can still use the full app locally.
- The login screen is only shown when there is no stored identity. Once signed in, it does not appear again until sign-out.
