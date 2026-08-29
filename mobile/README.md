# LifeAgent Expo mobile

## Quick start

```powershell
cd D:\Codex\黑客松\mobile
npm install
Copy-Item .env.example .env
npm run typecheck
npm test
npx expo start --web
```

Set `EXPO_PUBLIC_API_BASE_URL` to the backend origin, for example `http://192.168.1.10:8000`. The mobile app appends `/api/v1` to that origin. Use `EXPO_PUBLIC_API_MODE=mock` to inspect the UI without a running backend.

## Backend contracts

The app calls `POST /api/v1/chat`, `GET /api/v1/life-events`, `POST /api/v1/speech-to-text`, `GET /api/v1/weekly-reports`, and `GET /api/v1/weekly-reports/{report_id}/poster`. The speech request is multipart form data with `audio`, `user_id`, and `language`; the response is only written into the composer and is never sent automatically.

The weekly poster response is `image/svg+xml`. On native platforms it is fetched into the device cache as a temporary `.svg` file and shared with `expo-sharing`. No database, LLM, API key, recording, or signing file is stored by the mobile app.

## Real-device notes

For Expo Go on a phone, use a LAN address reachable from the phone instead of `localhost`. The backend must allow the phone's origin and expose the speech and weekly report routes before those flows can be completed. Android requests microphone permission at runtime; iOS uses the `NSMicrophoneUsageDescription` in `app.json`.
