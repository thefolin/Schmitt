# iOS Build Guide — Schmitt Odyssée

**Status:** iOS support for local testing only (abandoned as of 2026-09-19, see [CLAUDE.md](../CLAUDE.md))

**Quick Start:**
```bash
npm run ios:setup  # One-time setup
npm run ios:dev    # Build and run every time
```

---

## Prerequisites

### System Requirements
- **macOS 13.0+** (for Xcode 15+)
- **Minimum 20 GB free disk space** (mostly for Xcode)
- **Internet connection** for first-time setup

### Required Software

| Tool | Version | Install | Purpose |
|------|---------|---------|---------|
| **Node.js** | 18+ | https://nodejs.org/ | Web asset build |
| **npm** | 8+ | Included with Node | Package manager |
| **Xcode** | 14.0+ | App Store | iOS development IDE |
| **Xcode CLI Tools** | Latest | `xcode-select --install` | Command-line tools |
| **CocoaPods** | 1.12+ | `sudo gem install cocoapods` | iOS dependency manager |
| **Capacitor CLI** | 6.0+ | Included in npm deps | Bridge to native |

### Optional
- **Apple Developer Account** (free) — needed to test on physical device; NOT needed for simulator
- **Apple ID** (any) — auto-signing for device testing

---

## First-Time Setup

### Step 1: Xcode IDE
Xcode is the largest requirement (~13 GB). Choose one:

**Option A: App Store (Recommended)**
```bash
# Search for "Xcode" in App Store and click "Install"
# This is easiest and auto-updates
```

**Option B: Direct Download**
- Go to https://developer.apple.com/download/
- Sign in with Apple ID (free)
- Download `Xcode 15.x` or later
- Drag to `/Applications/Xcode.app`

**Option C: Verify Installation**
```bash
xcode-select -p
# Should output: /Applications/Xcode.app/Contents/Developer
```

### Step 2: Xcode Command-Line Tools
```bash
xcode-select --install
# Follow prompts; or skip if already installed
```

### Step 3: CocoaPods
```bash
sudo gem install cocoapods
# Enter your macOS password when prompted

# Verify:
pod --version
# Should output: 1.12.0 (or newer)
```

### Step 4: Initialize iOS Platform
```bash
cd /path/to/schmitt-odyssee
npm run ios:setup
```

This command:
- ✅ Checks all prerequisites
- ✅ Initializes iOS platform via Capacitor (`cap add ios`)
- ✅ Installs CocoaPods dependencies (`pod install`)
- ✅ Validates configuration

**Expected output:**
```
ℹ Checking prerequisites...
✓ Node.js: v20.x.x
✓ npm: 10.x.x
✓ Xcode: Xcode 15.x
✓ Xcode.app IDE: found
✓ CocoaPods: 1.12.0
✓ Capacitor CLI: ...
✓ Build config loaded

ℹ Initializing iOS platform...
✓ iOS platform initialized

ℹ Installing CocoaPods dependencies...
✓ CocoaPods dependencies installed

✓ === iOS setup complete ===
```

---

## Build Commands

### 1. Simulator Build (Most Common)
```bash
npm run ios:dev
```

**What it does:**
1. Builds web assets (Vue 3 + Three.js)
2. Syncs to iOS via Capacitor
3. Opens Xcode with the project ready to build

**In Xcode:**
- Select `App` scheme (top-left)
- Select simulator device (e.g., `iPhone 15`)
- Click **Product → Run** (⌘R)
- App launches in simulator in ~30 seconds

**Fast iteration:**
```bash
# Modify code in src/
npm run ios:dev    # Re-run to sync changes
# In Xcode: ⌘R to rebuild and relaunch
```

### 2. Physical Device Build
```bash
npm run ios:test
```

**What it does:**
- Same as `npm run ios:dev`, but configured for device testing

**Requirements:**
- Connect iPhone to Mac via USB cable
- Apple ID (free) for auto-signing
- Trust the app on iPhone after install

**In Xcode:**
1. Window → Devices and Simulators
2. Select your iPhone
3. Select `App` scheme
4. Click **Product → Run** (⌘R)
5. On iPhone: Settings → General → Device Management → Trust the app

**Common Issues:**
- "Team ID not set" — Xcode will auto-sign; just click "Enable"
- "Development certificate expired" — Refresh in Xcode settings
- App crashes on launch — Check Console output in Xcode

### 3. Release Build
```bash
npm run ios:build
```

**What it does:**
- Builds release archive (`.xcarchive`)
- Ready for testing or distribution

**Output:**
```
ios/App/build/Schmitt-1.0.0.xcarchive
```

**Note:** iOS is abandoned per CLAUDE.md. This is for testing only.

### 4. Clean Artifacts
```bash
npm run ios:clean
```

Removes build files and Xcode cache. Use if:
- Build fails mysteriously
- You need a fresh start
- CocoaPods were updated

---

## Configuration

### Build Settings
Edit `ios/build.config.json`:

```json
{
  "bundleId": "com.schmittodyssee.app",
  "appName": "Schmitt Odyssée",
  "appNameShort": "Schmitt",
  "version": "1.0.0",
  "buildNumber": 1,
  "minimumOSVersion": "13.0",
  "targetSDK": "17.0",
  "developmentTeam": "",
  "signingIdentity": "Apple Development"
}
```

**Key fields:**

| Field | Use | Notes |
|-------|-----|-------|
| `bundleId` | App identifier (iOS) | Must match `capacitor.config.ts` appId |
| `version` | Semantic version | Synced from `package.json` on each build |
| `buildNumber` | Build counter | Incremented for each release (auto-managed by CI) |
| `minimumOSVersion` | iOS target | Capacitor 6 requires iOS 13+ |
| `developmentTeam` | Apple Team ID | Leave empty for free Apple ID auto-signing |
| `signingIdentity` | Signing cert type | "Apple Development" for free; "iPhone Distribution" for App Store |

**Update version:**
- Edit `package.json` version
- Run any build command (syncs automatically)
- No need to manually edit `ios/build.config.json`

---

## Troubleshooting

### "Command not found: xcodebuild"
**Solution:** Install Xcode command-line tools:
```bash
xcode-select --install
```

### "CocoaPods not found"
**Solution:**
```bash
sudo gem install cocoapods
```

### "iOS platform not found" / "cap add ios failed"
**Solution:**
```bash
npm run ios:setup
```

If still fails:
```bash
rm -rf ios/
npm run ios:setup
```

### "Pod install failed"
**Solution:**
```bash
cd ios/App
pod repo update
pod install --repo-update
cd ../..
```

### Xcode Build Fails with "Code Signing Error"
**Solution:**
1. In Xcode: Product → Scheme → Edit Scheme
2. Build → Code Signing Identity → Select "Apple Development"
3. Team: Select your Apple ID

For device testing, Xcode auto-signs. Just click "Enable" when prompted.

### Simulator Build Succeeds but App Crashes
**Check Console in Xcode:**
1. Xcode → View → Debug Area → Show Console (⌘⇧C)
2. Look for red error messages
3. Common causes:
   - Missing JavaScript file (sync with `npm run ios:dev`)
   - Plugin permission issue (check `capacitor.config.ts`)
   - Three.js canvas error (check browser dev tools)

### "iPhone not trusted" on physical device
**Solution:**
1. On iPhone: Settings → General → Device Management
2. Tap your Apple ID
3. Tap "Trust"

### Slow Simulator Performance
**Solution:**
- Simulator uses software rendering; slower than device
- Try hardware acceleration: Simulator → File → Hardware → Device Performance → Higher

---

## Workflow Examples

### Daily Development
```bash
# Start: one terminal
npm run ios:dev

# In Xcode: Select App scheme + iPhone 15 simulator
# Product → Run (⌘R)

# Code edit cycle:
# 1. Edit code in src/
# 2. Terminal: npm run ios:dev (re-sync)
# 3. Xcode: ⌘R to rebuild
# 4. View in simulator immediately
```

### Test on Device
```bash
# Connect iPhone
npm run ios:test

# In Xcode:
# - Select your iPhone as destination
# - Product → Run (⌘R)
# - Trust on device when prompted
```

### Release Testing
```bash
npm run ios:build

# Creates ios/App/build/Schmitt-1.0.0.xcarchive
# Open in Xcode Organizer to export/distribute
```

### CI/CD Integration
```bash
# GitHub Actions can run:
npm run ios:setup
npm run ios:build

# Produces archive for beta testing or App Store submission
# (Not currently used per iOS abandonment, but available)
```

---

## Architecture & IA-Friendly Design

### File Structure
```
schmitt-odyssee/
├── ios/
│   ├── build.config.json          ← Centralized config (version, bundle ID, etc.)
│   ├── App/                        ← Xcode workspace (auto-generated by Capacitor)
│   │   ├── App.xcworkspace/
│   │   ├── Podfile / Podfile.lock  ← CocoaPods dependencies
│   │   └── www/                    ← Web assets (synced by Capacitor)
│   └── ...
├── scripts/
│   ├── ios-build.sh                ← Main build logic (setup, dev, test, release, clean)
│   └── validate-env.js             ← Environment validation
├── capacitor.config.ts             ← Capacitor bridge config
├── package.json                    ← npm scripts (ios:setup, ios:dev, etc.)
└── docs/
    └── iOS_BUILD.md                ← This file
```

### Design Principles
1. **Centralized config** (`ios/build.config.json`) — all settings in one file, easy for IA to modify
2. **Version sync** — `package.json` version → iOS build automatically
3. **Validation before build** — `scripts/validate-env.js` checks all prerequisites
4. **Clear logging** — colored output with helpful messages
5. **Modular scripts** — bash script (`ios-build.sh`) with clear functions
6. **IA-readable** — no hardcoding, all paths and config in variables or JSON

### For IA: Modifying the Build
To add features or modify behavior:

1. **Add a new npm script:**
   ```json
   "ios:something": "node scripts/validate-env.js && ./scripts/ios-build.sh something"
   ```

2. **Add a new build function:**
   ```bash
   # In scripts/ios-build.sh
   build_something() {
       log_info "=== Building Something ==="
       # ... commands ...
       log_success "Done"
   }

   # In main() switch statement:
   case "$command" in
       something)
           build_something
           ;;
   esac
   ```

3. **Update config:**
   Edit `ios/build.config.json` (JSON format, easy to parse)

---

## Resources

- **Capacitor iOS Guide:** https://capacitorjs.com/docs/ios
- **Xcode Documentation:** https://developer.apple.com/xcode/
- **CocoaPods Guide:** https://guides.cocoapods.org/
- **Apple Developer:** https://developer.apple.com/
- **Project CLAUDE.md:** [../CLAUDE.md](../CLAUDE.md)

---

## Status

- **Last Updated:** 2026-09-20
- **iOS Status:** Abandoned (debug/test only)
- **Supported:** Local testing on macOS with Xcode
- **Unsupported:** App Store release, TestFlight, CI/CD (GitHub Actions available but not primary)

**Questions?** See troubleshooting above or ask in project discussions.
