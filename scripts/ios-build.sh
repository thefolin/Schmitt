#!/bin/bash

##############################################################################
# iOS Build Script for Schmitt Odyssée
#
# Usage:
#   ./scripts/ios-build.sh setup      - Initialize iOS platform + dependencies
#   ./scripts/ios-build.sh dev        - Build debug for simulator
#   ./scripts/ios-build.sh test       - Build debug for physical device
#   ./scripts/ios-build.sh release    - Build release archive
#   ./scripts/ios-build.sh clean      - Clean build artifacts
#
# Environment:
#   iOS_CONFIG: Path to build.config.json (default: ios/build.config.json)
#   XCODE_PATH: Path to Xcode.app (auto-detected if not set)
##############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
IOS_CONFIG="${IOS_CONFIG:-$PROJECT_ROOT/ios/build.config.json}"
IOS_DIR="$PROJECT_ROOT/ios"
IOS_APP_DIR="$IOS_DIR/App"

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js not found. Install from https://nodejs.org/"
        exit 1
    fi
    NODE_VERSION=$(node -v)
    log_success "Node.js: $NODE_VERSION"

    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm not found"
        exit 1
    fi
    NPM_VERSION=$(npm -v)
    log_success "npm: $NPM_VERSION"

    # Check Xcode command-line tools
    if ! command -v xcodebuild &> /dev/null; then
        log_error "Xcode command-line tools not found"
        log_info "Install with: xcode-select --install"
        exit 1
    fi
    XCODE_VERSION=$(xcodebuild -version | head -1)
    log_success "$XCODE_VERSION"

    # Check for Xcode.app IDE (not just CLI tools)
    if [ ! -d "/Applications/Xcode.app" ]; then
        log_warn "Xcode.app IDE not found"
        log_info "Install from App Store or https://developer.apple.com/download/"
        log_info "Continuing... some commands may fail without the full IDE"
    else
        log_success "Xcode.app IDE found"
    fi

    # Check CocoaPods
    if ! command -v pod &> /dev/null; then
        log_error "CocoaPods not found"
        log_info "Install with: sudo gem install cocoapods"
        exit 1
    fi
    POD_VERSION=$(pod --version)
    log_success "CocoaPods: $POD_VERSION"

    # Check Capacitor CLI
    if ! command -v cap &> /dev/null; then
        log_error "Capacitor CLI not found"
        log_info "Install with: npm install -g @capacitor/cli"
        exit 1
    fi
    CAP_VERSION=$(cap --version 2>/dev/null || echo "unknown")
    log_success "Capacitor CLI: $CAP_VERSION"

    # Check build config exists
    if [ ! -f "$IOS_CONFIG" ]; then
        log_error "Build config not found: $IOS_CONFIG"
        exit 1
    fi
    log_success "Build config loaded"
}

# Initialize iOS platform (one-time setup)
setup_ios() {
    log_info "=== Setting up iOS Platform ==="

    check_prerequisites

    # Check if iOS already initialized
    if [ -d "$IOS_APP_DIR" ]; then
        log_warn "iOS platform already initialized at $IOS_APP_DIR"
        log_info "Skipping 'cap add ios'. Use 'npm run ios:clean' to reset."
    else
        log_info "Initializing iOS platform..."
        cd "$PROJECT_ROOT"
        npx cap add ios || {
            log_error "Failed to initialize iOS platform"
            exit 1
        }
        log_success "iOS platform initialized"
    fi

    # Install CocoaPods dependencies
    log_info "Installing CocoaPods dependencies..."
    if [ ! -f "$IOS_APP_DIR/Podfile.lock" ]; then
        cd "$IOS_APP_DIR"
        pod install --repo-update || {
            log_error "Failed to install CocoaPods dependencies"
            exit 1
        }
        cd "$PROJECT_ROOT"
        log_success "CocoaPods dependencies installed"
    else
        log_info "Podfile.lock exists, running 'pod install'..."
        cd "$IOS_APP_DIR"
        pod install || {
            log_error "Failed to update CocoaPods dependencies"
            exit 1
        }
        cd "$PROJECT_ROOT"
        log_success "CocoaPods dependencies updated"
    fi

    log_success "=== iOS setup complete ==="
    log_info "Next: Run 'npm run ios:dev' to build and run in simulator"
}

# Sync version from package.json to iOS config
sync_version() {
    log_info "Syncing version from package.json..."

    # Extract version from package.json
    PKG_VERSION=$(node -e "console.log(require('./package.json').version)")

    # Update ios/build.config.json with new version
    # Use Node.js to update JSON safely
    node -e "
        const fs = require('fs');
        const config = JSON.parse(fs.readFileSync('$IOS_CONFIG', 'utf8'));
        config.version = '$PKG_VERSION';
        fs.writeFileSync('$IOS_CONFIG', JSON.stringify(config, null, 2) + '\n');
    " || {
        log_error "Failed to sync version"
        exit 1
    }

    log_success "Version synced: $PKG_VERSION"
}

# Update Xcode project version
update_xcode_version() {
    local config_version=$(node -e "console.log(require('$IOS_CONFIG').version)")
    local build_number=$(node -e "console.log(require('$IOS_CONFIG').buildNumber)")

    log_info "Updating Xcode version: $config_version (build $build_number)..."

    if [ -f "$IOS_APP_DIR/App.xcodeproj/project.pbxproj" ]; then
        cd "$IOS_APP_DIR"

        # Update version using xcodebuild (safer than sed)
        # This is done via pbxproj manipulation in Xcode
        # For now, log what needs to be done
        log_info "Note: Version is synced in build.config.json"
        log_info "Xcode workspace will read this on next build"

        cd "$PROJECT_ROOT"
    fi
}

# Build for simulator (debug)
build_simulator() {
    log_info "=== Building for Simulator (Debug) ==="

    check_prerequisites
    sync_version

    # Build web assets
    log_info "Building web assets..."
    cd "$PROJECT_ROOT"
    CAPACITOR_PLATFORM=true npm run build || {
        log_error "Web build failed"
        exit 1
    }
    log_success "Web assets built"

    # Sync to iOS
    log_info "Syncing to iOS..."
    npx cap sync ios || {
        log_error "Capacitor sync failed"
        exit 1
    }
    log_success "Synced to iOS"

    # Open in Xcode
    log_info "Opening Xcode..."
    npx cap open ios || {
        log_error "Failed to open Xcode"
        exit 1
    }

    log_success "=== Ready to build in Xcode ==="
    log_info "In Xcode: Product → Run (⌘R) to build and run in simulator"
}

# Build for device (debug, with auto-signing)
build_device() {
    log_info "=== Building for Device (Debug) ==="

    check_prerequisites
    sync_version

    # Build web assets
    log_info "Building web assets..."
    cd "$PROJECT_ROOT"
    CAPACITOR_PLATFORM=true npm run build || {
        log_error "Web build failed"
        exit 1
    }
    log_success "Web assets built"

    # Sync to iOS
    log_info "Syncing to iOS..."
    npx cap sync ios || {
        log_error "Capacitor sync failed"
        exit 1
    }
    log_success "Synced to iOS"

    log_success "=== Ready to build on device ==="
    log_info "Requirements:"
    log_info "  1. Connect iPhone to Mac"
    log_info "  2. In Xcode: Window → Devices and Simulators"
    log_info "  3. Select your device"
    log_info "  4. Product → Run (⌘R)"
    log_info "  5. Trust the app on iPhone: Settings → General → Device Management"
    log_info ""
    log_info "Opening Xcode..."
    npx cap open ios || {
        log_error "Failed to open Xcode"
        exit 1
    }
}

# Build release archive
build_release() {
    log_info "=== Building Release Archive ==="

    check_prerequisites
    sync_version

    log_warn "iOS is abandoned (debug/test only per CLAUDE.md)"
    log_info "This archive is for testing only, not for App Store release"
    log_info ""

    # Build web assets
    log_info "Building web assets..."
    cd "$PROJECT_ROOT"
    CAPACITOR_PLATFORM=true npm run build || {
        log_error "Web build failed"
        exit 1
    }
    log_success "Web assets built"

    # Sync to iOS
    log_info "Syncing to iOS..."
    npx cap sync ios || {
        log_error "Capacitor sync failed"
        exit 1
    }
    log_success "Synced to iOS"

    # Archive with xcodebuild
    log_info "Building archive with xcodebuild..."
    cd "$IOS_APP_DIR"

    # Get version and bundle ID from config
    local version=$(node -e "console.log(require('$IOS_CONFIG').version)")
    local bundle_id=$(node -e "console.log(require('$IOS_CONFIG').bundleId)")

    local archive_path="build/Schmitt-$version.xcarchive"

    xcodebuild -workspace App.xcworkspace \
        -scheme App \
        -configuration Release \
        -destination 'generic/platform=iOS' \
        -archivePath "$archive_path" \
        archive || {
        log_error "xcodebuild archive failed"
        exit 1
    }

    log_success "Archive created: $archive_path"
    log_info "To export as .ipa, use Xcode's organizer or:"
    log_info "  xcodebuild -exportArchive -archivePath '$archive_path' ..."
}

# Clean build artifacts
clean_build() {
    log_info "Cleaning build artifacts..."

    # Clean Xcode build folder
    if [ -d "$IOS_APP_DIR" ]; then
        cd "$IOS_APP_DIR"
        xcodebuild clean -workspace App.xcworkspace -scheme App 2>/dev/null || true
        rm -rf build DerivedData .swiftpm
        cd "$PROJECT_ROOT"
    fi

    # Clean Capacitor sync
    rm -rf "$IOS_APP_DIR/www" 2>/dev/null || true

    log_success "Build artifacts cleaned"
}

# Main entry point
main() {
    local command="${1:-dev}"

    case "$command" in
        setup)
            setup_ios
            ;;
        dev)
            build_simulator
            ;;
        test)
            build_device
            ;;
        release)
            build_release
            ;;
        clean)
            clean_build
            ;;
        *)
            log_error "Unknown command: $command"
            echo ""
            echo "Usage: $0 {setup|dev|test|release|clean}"
            echo ""
            echo "Commands:"
            echo "  setup   - Initialize iOS platform + CocoaPods (one-time)"
            echo "  dev     - Build debug for simulator (opens Xcode)"
            echo "  test    - Build debug for device (opens Xcode)"
            echo "  release - Build release archive"
            echo "  clean   - Clean build artifacts"
            exit 1
            ;;
    esac
}

main "$@"
