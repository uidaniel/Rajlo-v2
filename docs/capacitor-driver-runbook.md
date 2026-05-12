# Rajlo Driver — Capacitor Android run-book

Everything below assumes:

- Android Studio is installed (`developer.android.com/studio`)
- A USB cable + Android phone in **developer mode** with **USB debugging** enabled (Settings → About phone → tap "Build number" 7 times → back to Settings → Developer options → USB debugging)
- You're working from `c:\Users\HP\OneDrive\Documents\Rajlo\Rajlo-v2`

## One-time setup (do this once)

### 1. Add the Android platform

This generates an `android/` folder at the project root — that's the
native project Android Studio will open. **Run this only after Android
Studio has been installed and run at least once** (so the SDK is
unpacked).

```powershell
npx cap add android
```

### 2. Sync the web assets + plugins

Copies the `capacitor-shell/` fallback into the Android project and
registers all the installed plugins.

```powershell
npx cap sync android
```

You'll re-run `cap sync` any time you add/remove a plugin or change
`capacitor.config.ts`. Routine web code changes don't need it (the
app loads from `server.url`).

### 3. Required permissions in `android/app/src/main/AndroidManifest.xml`

`cap add android` generates a stock manifest. Open it and add the
permissions Rajlo Driver needs — background location is the big one,
plus the foreground service required by Android 14+:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
```

Inside `<application ...>`, the background-geolocation plugin needs
its foreground service declared:

```xml
<service
  android:name="com.equimaps.capacitor_background_geolocation.BackgroundGeolocationService"
  android:foregroundServiceType="location"
  android:exported="false" />
```

> The plugin's own README is the source of truth — paste the latest
> snippet from there if these names ever change.

### 4. App icon + splash screen

Drop your icon assets into `android/app/src/main/res/`:

- `mipmap-mdpi/ic_launcher.png` (48×48)
- `mipmap-hdpi/ic_launcher.png` (72×72)
- `mipmap-xhdpi/ic_launcher.png` (96×96)
- `mipmap-xxhdpi/ic_launcher.png` (144×144)
- `mipmap-xxxhdpi/ic_launcher.png` (192×192)

Use **Android Studio → File → New → Image Asset** to auto-generate
all five sizes from your existing brand SVG (`public/email-logo-white.png`
works as a starting point; pick a square crop).

Splash screen: the red `backgroundColor` in `capacitor.config.ts` will
fill the screen before the WebView paints. To put the Rajlo wordmark
on it, drop a `splash.png` into the same `drawable/` folders.

## Day-to-day commands

| Action                                | Command                  |
| ------------------------------------- | ------------------------ |
| Open the Android project in Studio    | `npx cap open android`   |
| Sync after a plugin/config change     | `npx cap sync android`   |
| Build + run on a connected phone      | `npx cap run android`    |
| Reload the WebView with latest web    | `npx cap copy android`   |

Most of the time you only need `cap open android` — Android Studio
has a green ▶ Run button that builds + installs + launches the app
in ~30 seconds.

## How to test background GPS specifically

This is the whole reason we wrapped, so it's the thing to verify on
day one:

1. Install the app on your phone via `npx cap run android`.
2. Sign in as a driver, go online, accept a test ride from a second
   phone (or use a rider account on a desktop browser).
3. While the trip is `in_progress`, lock the phone screen.
4. Wait 30-60 seconds, then look at the rider's live-trip view (on
   the other phone / desktop).

**Expected:** the car marker keeps moving — Android shows a "Rajlo is
sharing your location for an active trip" notification while the
service runs.

**If the marker freezes the moment the screen locks:** the foreground
service didn't start. Check Android Studio's Logcat (`adb logcat`) for
"BackgroundGeolocation" entries, and verify the manifest permissions
above.

## Releasing to the Play Store

For internal testing first (your own phone + a few drivers you trust):

1. Build a signed AAB: **Android Studio → Build → Generate Signed Bundle / APK → Android App Bundle**. First time, Studio walks you through creating a keystore — **save the keystore file + password somewhere safe, you can never recover it.**
2. Upload to **Play Console → Internal Testing**. Add tester emails.
3. Each tester clicks the opt-in link, installs from Play Store.

Going to production:

1. Promote the internal build to **Closed Testing** (~20 drivers), then **Open Testing**, then **Production**.
2. Google reviews each promotion — usually <24h on Closed/Open, 1-3 days on first Production submission.
3. You'll need a privacy policy URL (`https://rajlo.com/legal/privacy` works once the apex is live), screenshots, and a short description.

## When to swap the URL to the real domain

Right now `capacitor.config.ts` points at `https://rajlo-v2.vercel.app/driver`.
On launch day, when you point `driver.rajlo.com` at Vercel:

1. Edit `capacitor.config.ts` → change `server.url` to `https://driver.rajlo.com`.
2. Run `npx cap sync android`.
3. Rebuild + re-upload the AAB to Play Console (new internal-testing version is enough — testers update automatically).

That's the only native rebuild required for the URL flip.
