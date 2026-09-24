# FreshGoods — Android Build Environment Setup

This documents the Windows environment required to build the FreshGoods Android app locally. It reflects what Stage 3.5 verified working on 2026-08-10.

## Requirements

| Component | Required version | Notes |
|---|---|---|
| Java | JDK 17 | `JAVA_HOME` must point at the JDK 17 install |
| Node.js | v22.x | v22.14.0 verified working |
| Android compileSdk / targetSdk | 36 | Set automatically by Expo's Gradle plugin (`ExpoRootProjectPlugin`), not hardcoded in this repo |
| Android minSdk | 24 | |
| Android Build-Tools | 36.0.0 | |
| Android NDK | 27.1.12297006 | |
| Gradle | 8.14.3 (via wrapper) | Do not change `android/gradle/wrapper/gradle-wrapper.properties` without verifying compatibility first |
| Kotlin | 2.1.20 (resolved by AGP/Expo plugin) | |
| Expo SDK | ~54.0.0 | |
| React Native | 0.81.5 | |

The exact SDK/build-tools/NDK/Kotlin versions above are not hand-picked — they're printed by Gradle itself at the start of every build (`[ExpoRootProject] Using the following versions: ...`), driven by the installed Expo/RN package versions. If you upgrade Expo/RN, re-check this output rather than assuming these numbers still apply.

## Environment variables (User scope, no admin required)

```
ANDROID_HOME=C:\Users\<you>\AppData\Local\Android\Sdk
ANDROID_SDK_ROOT=C:\Users\<you>\AppData\Local\Android\Sdk
```

PATH should include:
```
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\cmdline-tools\latest\bin
```

`android/local.properties` (gitignored, machine-specific) must contain:
```
sdk.dir=C:/Users/<you>/AppData/Local/Android/Sdk
```

## One required admin-level OS setting

Windows' classic 260-character path limit breaks CMake/Ninja native builds (`react-native-worklets`, `react-native-reanimated`, `expo-modules-core` all compile C++). This must be enabled once, as Administrator:

```powershell
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -Type DWord
```
Restart the machine after setting this.

**Important:** enabling long paths alone is not sufficient — see "Project location" below.

## Project location

Keep this repo at a short path close to a drive root (e.g. `D:\FreshGoodsRepo`). CMake's Ninja generator enforces a hardcoded `CMAKE_OBJECT_PATH_MAX=250` character limit for object file paths that is **independent of the Windows long-path OS setting** — it is a CMake-internal safety check, not a Win32 API limitation. A deeply nested project path (e.g. one with 5+ folder levels before even reaching `node_modules/<package>/android/.cxx/...`) will exceed this limit and fail native builds with `ninja: error: manifest 'build.ninja' still dirty after 100 tries`, regardless of the OS-level setting.

## Build command

```powershell
cd android
./gradlew :app:assembleDebug
```

Output APK: `android/app/build/outputs/apk/debug/app-debug.apk`

First build takes ~13 minutes (native C++ compilation for Reanimated/Worklets/Expo modules across 4 ABIs). Subsequent builds are much faster via Gradle's build cache.

## Physical device verification

```powershell
adb devices          # confirm device listed with USB debugging enabled
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```
