# Play Store release runbook

Step-by-step for cutting a new Play Store update. Read this top to
bottom the first time you ship a release.

---

## One-time setup — get a signed-release keystore

You can't update an existing Play Store listing without the original
upload key. You have two paths:

### Option A — get the keystore from whoever first uploaded

Ask them for these four things:

1. The keystore file itself (`*.jks` or `*.keystore`)
2. Keystore password
3. Key alias name
4. Key password

Once you have them, jump to **"Wire it up"** below.

### Option B — reset the upload key via Play Console

Available when **Play App Signing** is enabled for the app (default
for every app uploaded after 2020 — ~99% likely yours uses it).

1. Open Play Console → your app → **Setup** → **App integrity**
2. Find **App signing** → **Use new key for upload**
3. Follow the wizard. You'll be prompted to:
   - Generate a new keystore locally (`keytool -genkey -v -keystore rajlo-upload-key.jks -keyalg RSA -keysize 2048 -validity 25000 -alias rajlo-upload`)
   - Upload the corresponding certificate (`keytool -export -rfc -keystore rajlo-upload-key.jks -alias rajlo-upload -file upload-cert.pem`)
4. Google reviews and approves — typically 24–48 hours. **You can't
   upload until approval lands.**

When approved, your new keystore becomes the upload key. Continue
with **"Wire it up"**.

---

## Wire it up — bind the keystore to gradle

Once you have a keystore + the four passwords:

1. Copy the keystore file into `android/` (e.g. `android/rajlo-upload-key.jks`)
2. Copy `android/key.properties.example` to `android/key.properties`
3. Edit `android/key.properties` with the real values:

   ```properties
   storeFile=rajlo-upload-key.jks
   storePassword=YOUR_KEYSTORE_PASSWORD
   keyAlias=YOUR_KEY_ALIAS
   keyPassword=YOUR_KEY_PASSWORD
   ```

`.gitignore` already excludes `key.properties` + every `*.jks` /
`*.keystore` so this never goes to GitHub.

---

## Each release

### 1. Bump the version

`android/app/build.gradle`:

- `versionCode` → must be strictly greater than the highest code on
  Play Store across any track (production, internal, closed). We use
  the date-encoded format `YYYYMMDD` so it always goes up.
- `versionName` → human-readable (`1.0.1`, `1.1.0`, etc.)

### 2. Sync + build

```bash
# From repo root
npx cap sync android

# From android/
cd android
./gradlew bundleRelease
```

Output: `android/app/build/outputs/bundle/release/app-release.aab`

### 3. Smoke-test the release build locally

The release build behaves differently from debug — minified, signed,
no debug bridge. Install it on your phone first:

```bash
# Convert AAB to installable APK with bundletool (one-time install)
bundletool build-apks --bundle=app/build/outputs/bundle/release/app-release.aab \
  --output=app/build/outputs/release.apks --mode=universal
bundletool install-apks --apks=app/build/outputs/release.apks
```

Open the app — confirm the dashboard, online toggle, map, push,
background GPS all still work.

### 4. Upload to Play Console

1. Play Console → your app → **Production** (or **Internal testing**
   first if you want a safer rollout)
2. **Create new release** → upload `app-release.aab`
3. Write release notes (~500 chars). Examples we've shipped already:
   - "Verify Your Ride PIN — optional 4-digit pickup safety check"
   - "Map now follows your car as you drive"
   - "Faster page loads across the app"
4. **Save** → **Review release** → **Start rollout to Production**

### 5. After upload

- Production: rollout to 100% is usually instant; some apps stage
  to 20% → 50% → 100% over a few hours
- App review: Google's automated checks take ~minutes for an update,
  longer for first-time submissions. Most updates publish within an
  hour of rollout

---

## Common rejections / how to fix

| What Play says | What it means | Fix |
| --- | --- | --- |
| "Your app bundle is signed with a different signing key" | Wrong keystore | Use the right one — see Option A / B above |
| "Version code 1 has already been used" | versionCode too low | Bump it |
| "Targets API level less than 34" | Old targetSdkVersion | Update `targetSdkVersion` in `android/variables.gradle` |
| "Sensitive permissions require declaration" | Background location, etc. | Add justification in Play Console under **App content** → **Permissions** |
| "App must comply with families policy" / removed | Marked as for kids accidentally | Toggle off in Play Console |

---

## Background-location declaration (one-time, but required)

Play Store requires apps that use `ACCESS_BACKGROUND_LOCATION`
(which we do, for live driver tracking) to declare this in
**Play Console** → **Policy** → **App content** →
**Sensitive permissions and APIs**.

Suggested copy:

> Rajlo Driver streams the signed-in driver's GPS while they are
> live and during an active trip. Background location is required
> so the rider's map stays accurate when the driver locks their
> phone or switches apps. Without it, riders would see a frozen
> car marker and trips couldn't be matched reliably.

This declaration needs to be submitted **before** the first release
that uses the permission goes live, but it stays on file for future
updates — you only do this once.
