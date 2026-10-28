# Publishing the iPhone app to the App Store

Bundle ID `com.redaawad.workoutlog`, version 1.0, iPhone only, portrait only.
Updates install over the existing app, so the on-device log is kept (never change the bundle ID).

## 1. Apple Developer Program (Reda)

The free Apple ID can't publish. Enroll at https://developer.apple.com/programs/enroll/
($99/year, as an individual; approval usually takes a day or two). Then in Xcode → Settings → Accounts,
sign in and note the new **Team ID** (Membership page on developer.apple.com).

## 2. Sign in with Apple (required, App Store rule 4.8)

The app offers Google sign-in, so it must also offer Sign in with Apple. The button appears by itself
once Apple is enabled in Supabase.

1. developer.apple.com → Certificates, IDs & Profiles → Identifiers → `com.redaawad.workoutlog` →
   tick **Sign in with Apple**.
2. Identifiers → + → **Services ID**, e.g. `com.redaawad.workoutlog.signin`; enable Sign in with Apple,
   domain `lgbtzvvgaemlpnuktssx.supabase.co`, return URL
   `https://lgbtzvvgaemlpnuktssx.supabase.co/auth/v1/callback`.
3. Keys → + → enable Sign in with Apple → download the `.p8` key (keep it private).
4. Supabase dashboard → Authentication → Sign In / Providers → Apple: Client IDs
   `com.redaawad.workoutlog.signin`, plus the Team ID, Key ID and `.p8` to generate the secret.
   The secret expires every 6 months; set a reminder to regenerate it.

## 3. Account deletion (required, rule 5.1.1(v))

Reports → Backup → Delete account calls `public.delete_my_account()`
(`supabase/migrations/20261028000000_delete_account.sql`). The migration must be applied to the
Supabase project before review. It is additive: it only adds a function.

## 4. App Store Connect listing

https://appstoreconnect.apple.com → Apps → + → New App: iOS, bundle ID `com.redaawad.workoutlog`,
SKU `workoutlog`, primary language English.

- **Name** (must be unique on the store; "Workout Tracker" alone is taken): e.g.
  `Lift Log: Workout Tracker`, `Nocturne Workout Log`, `Reda's Workout Log`. The home-screen name stays "Workout Tracker".
- **Subtitle** (30): `Gym log, diet & progress`
- **Category**: Health & Fitness (secondary: Lifestyle)
- **Age rating**: answer "None" to everything → 4+
- **Price**: Free. No in-app purchases (the subscription paywall stays off in the iPhone app; selling
  digital subscriptions in the app would need Apple In-App Purchase).
- **Privacy policy URL**: https://workout-traker.vercel.app/privacy
- **Support URL**: https://workout-traker.vercel.app/support
- **Keywords** (100): `gym,workout,log,lifting,strength,ppl,push pull legs,diet,calories,progress,reps,sets`
- **Promotional text**: `Log sets in seconds, follow your split and watch every lift trend up.`
- **Description**:

  > A fast, private gym log for people who lift.
  >
  > • Log sets, reps and weight in a couple of taps, with your program's exercises ready for the day
  > • Full body, Push / Pull / Legs or your own programs, with either/or exercise swaps
  > • Progress charts for every lift, machine max targets and muscle recovery hints
  > • Diet log with calories and protein, including Arabic food names
  > • Reports for today, 7 days, 30 days and all time
  > • Share any range of days with your favourite AI app for coaching
  > • Works offline. Your log stays on your phone; optional Apple or Google sign-in syncs it between devices
  > • Export JSON or Markdown backups any time
  >
  > No ads. No tracking.

- **App Privacy** (nutrition label): Data collected, not used for tracking, linked to the user, purpose
  App Functionality only: Contact Info → Email Address; Identifiers → User ID; Health & Fitness →
  Fitness and Health. Everything else: not collected. (Matches `ios/App/App/PrivacyInfo.xcprivacy`.)
- **Export compliance**: answered in Info.plist (`ITSAppUsesNonExemptEncryption = NO`).
- **Screenshots**: 6.9" iPhone (1320 × 2868), 3 to 10 images: Log, Progress, Diet, Reports, History.
- **Review notes**: "Sign-in is optional; every feature works without an account. To test sync, use
  Sign in with Apple on the Account & data screen (Reports → Backup)."

## 5. Build and upload (on the Mac)

```sh
cd ~/Documents/Workout-Traker
git pull && npm ci && npm run ios
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath build/App.xcarchive \
  DEVELOPMENT_TEAM=<paid team id> -allowProvisioningUpdates archive
xcodebuild -exportArchive -archivePath build/App.xcarchive \
  -exportOptionsPlist ios/ExportOptions.plist -exportPath build/export -allowProvisioningUpdates
```

Or in Xcode: pick "Any iOS Device", Product → Archive → Distribute App → App Store Connect.
The build appears in App Store Connect (and TestFlight) after about 15 minutes of processing.

## 6. Submit

Attach the build to version 1.0, fill in the listing above, Add for Review → Submit. Review usually
takes 1 to 2 days. For each later update bump the version (Xcode → App target → General → Version),
archive and upload again.
