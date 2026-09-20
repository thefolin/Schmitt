#!/usr/bin/env node

/**
 * Environment Validation Script for iOS Build
 *
 * Checks that all required tools are installed and accessible.
 * Provides helpful error messages if anything is missing.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    blue: '\x1b[34m',
};

function log(level, message) {
    const prefix = {
        info: `${colors.blue}ℹ${colors.reset}`,
        success: `${colors.green}✓${colors.reset}`,
        warn: `${colors.yellow}⚠${colors.reset}`,
        error: `${colors.red}✗${colors.reset}`,
    }[level];

    console.log(`${prefix} ${message}`);
}

function checkCommand(cmd, errorMsg, infoMsg = null) {
    try {
        execSync(`which ${cmd} > /dev/null 2>&1`);
        if (infoMsg) {
            log('success', infoMsg);
        }
        return true;
    } catch {
        log('error', errorMsg);
        return false;
    }
}

function getVersion(cmd) {
    try {
        return execSync(`${cmd} --version 2>&1`, { encoding: 'utf8' }).split('\n')[0].trim();
    } catch {
        return 'unknown';
    }
}

function main() {
    console.log(`\n${colors.blue}=== iOS Build Environment Check ===${colors.reset}\n`);

    let allOk = true;

    // Check Node.js
    if (checkCommand('node', 'Node.js not found. Install from https://nodejs.org/', `Node.js: ${getVersion('node')}`)) {
        // OK
    } else {
        allOk = false;
    }

    // Check npm
    if (checkCommand('npm', 'npm not found.', `npm: ${getVersion('npm')}`)) {
        // OK
    } else {
        allOk = false;
    }

    // Check Xcode CLI tools
    if (checkCommand('xcodebuild', 'Xcode command-line tools not found. Run: xcode-select --install', `Xcode CLI: installed`)) {
        // OK
    } else {
        allOk = false;
    }

    // Warn about Xcode.app IDE
    if (!fs.existsSync('/Applications/Xcode.app')) {
        log('warn', 'Xcode.app IDE not found. Download from App Store or https://developer.apple.com/download/');
        log('warn', 'Some commands will fail without the full IDE.');
    } else {
        log('success', 'Xcode.app IDE: found');
    }

    // Check CocoaPods
    if (checkCommand('pod', 'CocoaPods not found. Install with: sudo gem install cocoapods', `CocoaPods: ${getVersion('pod')}`)) {
        // OK
    } else {
        allOk = false;
    }

    // Check Capacitor CLI
    if (checkCommand('cap', 'Capacitor CLI not found. Install with: npm install -g @capacitor/cli', `Capacitor: ${getVersion('cap')}`)) {
        // OK
    } else {
        allOk = false;
    }

    // Check build config
    const configPath = path.join(__dirname, '..', 'ios', 'build.config.json');
    if (fs.existsSync(configPath)) {
        log('success', 'Build config: ios/build.config.json');
    } else {
        log('warn', `Build config not found: ${configPath}`);
    }

    console.log();

    if (!allOk) {
        log('error', 'Some prerequisites are missing. Please install them and try again.');
        process.exit(1);
    }

    log('success', 'All prerequisites met. Ready to build!');
    console.log();
}

main();
