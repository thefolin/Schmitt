# iOS Quick Start — Schmitt Odyssée

**Time to first build: 30 min (one-time setup) + 1 min per rebuild**

## One-Time Setup (30 min)

### Prerequisites Checklist
- [ ] macOS 13.0+ with 20+ GB free disk space
- [ ] Node.js 18+ installed (`node --version`)
- [ ] Xcode CLI tools installed (`xcode-select --install`)

### Install Xcode IDE
```bash
# App Store (easiest, auto-updates)
# Search "Xcode" in App Store → Install

# OR direct download (if App Store is slow)
# https://developer.apple.com/download/ → Download Xcode 15.x
```

### Install CocoaPods
```bash
sudo gem install cocoapods
```

### Initialize iOS
```bash
npm run ios:setup
# Takes ~5 min on first run
```

**Done!** You're ready to build.

---

## Build & Run (1 min)

### Simulator (Most Common)
```bash
npm run ios:dev
```
Xcode opens. In Xcode:
- Select **iPhone 15** simulator (top-left)
- Click **Product → Run** (⌘R)
- App launches in ~30 seconds

### Physical iPhone
```bash
npm run ios:test
```
Connect iPhone via USB, then same as simulator above.

### Release Build
```bash
npm run ios:build
```
Creates `ios/App/build/Schmitt-*.xcarchive`

---

## Fast Development Loop

```bash
# Terminal 1: Build once
npm run ios:dev

# In Xcode: Product → Run (⌘R)

# Loop: Edit code → npm run ios:dev → ⌘R in Xcode
```

Rebuild time: ~30-45 seconds per cycle

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "xcodebuild not found" | `xcode-select --install` |
| "CocoaPods not found" | `sudo gem install cocoapods` |
| "iOS platform not found" | `npm run ios:setup` |
| "Slow simulator" | Try different device (iPad = faster) |
| "App crashes" | Xcode → View → Console (⌘⇧C) |
| "Can't trust app on device" | iPhone → Settings → General → Device Management |

**Full troubleshooting:** See [docs/iOS_BUILD.md](docs/iOS_BUILD.md)

---

## Files Reference

| File | Purpose |
|------|---------|
| `ios/build.config.json` | Version, bundle ID, settings (edit this) |
| `scripts/ios-build.sh` | Main build logic |
| `scripts/validate-env.js` | Check prerequisites |
| `package.json` | npm scripts (`ios:setup`, `ios:dev`, etc.) |
| `docs/iOS_BUILD.md` | Full documentation |

---

## Configuration

Edit `ios/build.config.json` to change:
```json
{
  "bundleId": "com.schmittodyssee.app",
  "appName": "Schmitt Odyssée",
  "version": "1.0.0",
  "minimumOSVersion": "13.0"
}
```

**Version:** Synced from `package.json` automatically. Edit `package.json` version only.

---

## Status

✅ **Local testing ready** (simulator + device)  
✅ **Abandoned per CLAUDE.md** (not for App Store)  
✅ **Debug/test only**

---

**Need help?** See [docs/iOS_BUILD.md](docs/iOS_BUILD.md) or [iOS_BUILD.md troubleshooting section](docs/iOS_BUILD.md#troubleshooting).
