# SportyLive — Native Android (Kotlin + Jetpack Compose)

Native Android rebuild of **SportyLive** preserving the light-neumorphic ice-blue theme (`#EAF2FF` / `#EEF4FF` / `#E6EFFD`), custom team & league badges, and all screens.

## Features Implemented
- **Light Neumorphism System**: Custom `neuSurface` and `neuInset` Compose modifiers with soft dual-sided shadows.
- **Home Screen**: Sliding 6-slide Hero Carousel, 5-column Sport Categories (`Football`, `Basketball`, `Tennis`, `Boxing` + expandable `More`), horizontal `Live Now` carousel with `See All` vertical toggle, native Android `Intent.ACTION_SEND` + clipboard match sharing, full visible league pill, red `Watch Live` CTA, and `Upcoming Events` with circular bell reminder toggles.
- **Live TV Screen**: Sport filter pills plus `Featured Channels` and `Recently Added Channels` horizontal shelves (`View All` expands to 2-column grid) with recessed circular emblem discs.
- **Fixtures & Profile Screens**: Schedule filters (`All`, `Today`, `This Week`, `Reminders`), saved kickoff alerts, stream quality preferences, and **Join Us on Telegram** Channel & Group links.
- **Native Video Player & Dual PiP**: Powered by **Media3 ExoPlayer** (includes `res/raw/sample_clasico.mp4` on the first match card), **Similar & Related** streams below the player, an in-app draggable PiP overlay, and Android OS `PictureInPictureParams` support.

## Website Parity (Recent)
- **Accounts on device**: Create an account with username, password and country, sign in/out, and browse as a Guest User. Passwords are stored as salted PBKDF2 hashes in `SharedPreferences` (`AccountRepository`); accounts are device-local.
- **Upcoming vs Scheduled**: Fixtures within 4 hours of kickoff appear under **Upcoming**; later fixtures (5+ hours) remain under **Scheduled**.
- **Upcoming card design**: Upcoming fixtures reuse the live arena card with an **UPCOMING** badge, live countdown, reminder bell, and Preview / Kickoff Info action.
- **Seeded fixtures**: Four Upcoming and four Scheduled fixtures are generated relative to app launch, so both sections start populated.
- **Fixtures screen split**: The Fixtures tab mirrors the same Upcoming/Scheduled split with `Today`, `This Week`, and `Reminders` filters.

### Not yet ported
- **Admin playlist enable/disable** is an admin-console feature and has no native equivalent (there is no admin console in the Android app).
- Accounts are **not shared with the website** yet. Sharing them would require pointing the app at the website's `/api/auth` backend and adding a configurable base URL.

## Running in Android Studio
1. Export/download the workspace.
2. Open the `android-app` folder in **Android Studio** (Ladybug or newer).
3. Allow Gradle sync to download dependencies (`compileSdk 35`, `minSdk 24`).
4. Run on an Android device or emulator (`app` configuration).
