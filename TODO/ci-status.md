# CI/CD Build Status — refonte-3d

## Build Trigger Request

**Date:** 2026-09-20
**Branch:** `refonte-3d`
**Workflow:** `android-build.yml`
**Build Type:** release
**Output Format:** APK
**Status:** Awaiting Manual Trigger

## Context

20+ commits are staged on the `refonte-3d` branch and ready for Android pre-release APK build.

## Workflow Command

```bash
gh workflow run android-build.yml --ref refonte-3d --field build_type=release --field output_format=apk
```

## Alternative: GitHub Web Interface

1. Go to: https://github.com/thefolin/Schmitt/actions/workflows/android-build.yml
2. Click "Run workflow"
3. Select branch: `refonte-3d`
4. Set `build_type` = `release`
5. Set `output_format` = `apk`
6. Click "Run workflow"

## Tracking

- **Run ID:** (pending trigger)
- **Estimated Duration:** ~5 minutes
- **APK Output:** Will be available in workflow artifacts once complete

## Notes

- The `gh` CLI is not available in this agent environment
- Quentin must trigger the workflow manually via GitHub web interface or CLI
- Once triggered, monitor at: https://github.com/thefolin/Schmitt/actions?query=workflow:android-build.yml+branch:refonte-3d
