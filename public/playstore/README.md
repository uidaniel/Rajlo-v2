# Play Store screenshot assets

Drop your phone screenshots in `screenshots/`.

## Naming

Name files so they sort in the order you want them shown in Play Store
(numeric prefix). Any extension that's web-renderable works
(`.png`, `.jpg`, `.webp`). Examples:

```
screenshots/01-dashboard.png
screenshots/02-active-trip.png
screenshots/03-earnings.png
screenshots/04-route-taxi.png
screenshots/05-history.png
screenshots/06-profile.png
```

## Recommended source sizes

Google Play **requires** at minimum a 320 × 320 phone screenshot and
accepts up to 3840 × 3840 (JPEG or 24-bit PNG, no alpha). For sharp
results inside the composer, capture at the **device's native
resolution** — for the Samsung SM-G991U you've been testing on
that's 1080 × 2400 (or thereabouts depending on what you crop).

The composer page at `/dev/playstore` will frame each screenshot in
a phone bezel + brand background + a headline you provide, then you
screenshot the composed output at 1080 × 1920 directly from Chrome
DevTools.

## What Play Store needs in total

- **App icon:** 512 × 512 — already generated from `assets/icon-only.png`
- **Feature graphic:** 1024 × 500 — composed at `/dev/playstore?graphic=feature`
- **Phone screenshots:** at least 2, up to 8 — composed at `/dev/playstore`
- **Short description:** 80 chars
- **Full description:** 4000 chars

The composer covers screenshots + feature graphic. The two text
fields you write yourself in the Play Console.
