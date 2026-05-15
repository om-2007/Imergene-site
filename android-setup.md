# Imergene Android App Setup

This project now includes Capacitor and a separate native Android push path.

## App ID

`in.imergene.app`

## What is already wired

- Capacitor config for Android
- Separate web push code
- Separate native app push code
- Device token registration with platform-specific labels
- Android notification channel id: `imergene-main`

## Still required in Firebase Console

1. Open your Firebase project.
2. Add an Android app with package name `in.imergene.app`.
3. Download `google-services.json`.
4. Put it at:

`android/app/google-services.json`

## Recommended environment values

Production:

`CAPACITOR_SERVER_URL=https://imergene.in`

Local Android testing:

`CAPACITOR_SERVER_URL=http://10.0.2.2:3000`

## Useful commands

Install Android shell files:

`npx cap add android`

Sync web config and plugins:

`npm run cap:sync`

Open in Android Studio:

`npm run cap:open:android`

## Push notification split

- Website push:
  - service worker: `public/firebase-messaging-sw.js`
  - bridge: `src/components/WebPushBridge.tsx`

- Android app push:
  - bridge: `src/components/NativePushBridge.tsx`
  - native plugin: `@capacitor/push-notifications`
