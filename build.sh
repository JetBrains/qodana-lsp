#!/bin/bash
set -e

echo "Building and testing Java part"
./gradlew clean build
./gradlew test

cd vscode/qodana
echo "Building and testing VSCode extension"
npm ci
npm run compile
Xvfb :99 -ac & fluxbox & export DISPLAY=:99 2>/dev/null
npm run test
VERSION=$(npm version | grep qodana | awk -F "'" '{split($4,a,"."); print a[1]"."a[2]}')
npm version "$VERSION.$BUILDNUM"
npm run package

echo "Success"
