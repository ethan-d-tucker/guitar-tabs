# Expo Go Crash on Launch — Debug Notes

## Problem
App crashes immediately after opening in Expo Go on a physical device (iPhone/Android). No error logs appear in the Metro terminal. The app loads briefly, then closes.

## Setup
- Expo SDK 55 (`expo@~55.0.4`)
- React Native 0.83.2
- Metro running on port 8082 (`exp://192.168.12.38:8082`)
- Web version works fine at `http://localhost:8082`

## What to check first
1. **Expo Go version**: SDK 55 requires the latest Expo Go. Update it from App Store / Play Store.
2. **If still crashing after update**: The app may need a **development build** instead of Expo Go, since it uses native modules (`expo-sqlite`, `expo-file-system`, `expo-print`, `expo-sharing`). Run `npx expo run:ios` or `npx expo run:android` to create a dev build.
3. **To get actual crash logs**: Try `npx expo start --dev-client` or check device logs via Xcode (iOS) or `adb logcat` (Android).

## Recent changes (annotations feature)
These files were modified to add inline annotations. If reverting is needed, the key changes are:
- `src/models/Song.ts` — added `annotations: SongAnnotations` field
- `src/db/songs.ts` — added `annotations` column, `ALTER TABLE` migration, `updateAnnotations()` function
- `src/components/SongPreview.tsx` — added annotation rendering + `onAnnotationPress` callback
- `app/song/[id].tsx` — added annotation editor modal, PDF export toggle
- `src/services/pdf-generator.ts` — added `includeAnnotations` parameter
- `src/services/pdf-styles.ts` — added `.annotation-block` CSS
- `src/constants/theme.ts` — added `annotationBg`, `annotationBorder` colors
- `app/index.tsx` — added annotation toggle to bulk PDF export

## Project location
`C:\Users\Ethan\Desktop\Guitar Tabs`
