# Contributing to Qodana LSP

## Development

### Prerequisites

- JDK 11 or higher
- Node.js 20.18 or higher
- Gradle

### Building

```bash
# Build LSP server (Java)
./gradlew shadowJar

# Build VS Code extension
cd vscode/qodana
npm ci
npm run compile
npm run package
```

## Release Process

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/) for automated changelog generation:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `chore:` - Maintenance tasks
- `refactor:` - Code refactoring
- `test:` - Test changes
- `perf:` - Performance improvements

Examples:
```
feat: add support for Qodana Rust linter (QD-13871)
fix: resolve latest report opening issue (QD-13470)
chore: update CLI to 2026.1.0 (QD-14515)
```

### Creating a Release

Releases are mostly automated. When you push a version tag, the workflow automatically:
1. Prepares the release (updates CHANGELOG, package.json, package-lock.json)
2. Builds the extension
3. Creates GitHub release with auto-generated notes
4. Publishes to VS Code Marketplace and Open VSX Registry

**Steps:**

1. **Update dependencies** (if needed):
   ```bash
   # Update Qodana CLI
   node scripts/update-cli.js
   git add vscode/qodana/src/core/cli/cli.json
   git commit -m "chore: update CLI to <version> (QD-XXXXX)"
   git push

   # Dependabot will automatically create PRs for:
   # - GitHub Actions updates
   # - npm dependencies updates
   ```

2. **Add manual CHANGELOG entries** (optional):

   If needed, manually add entries to the `[Unreleased]` section in `vscode/qodana/CHANGELOG.md`. The workflow will merge these with auto-generated entries from conventional commits.

   **Merge behavior:**
   - Manual entries are preserved as-is in their original format
   - Auto-generated entries are formatted as `QD-XXXXX: Description`
   - Manual entries take priority: if a ticket ID (e.g., QD-14520) appears in any manual entry, the auto-generated entry for that ticket is skipped
   - If no changes are found (neither manual nor auto-generated), CHANGELOG update is skipped, but package.json and package-lock.json are still updated to the tag version

3. **Create and push tag**:
   ```bash
   # Create annotated tag for version 1.2.0
   git tag -a v1.2.0 -m "Release v1.2.0"

   # Push tag to trigger automated release
   git push origin v1.2.0
   ```

4. **Automated workflow** will:
   - Check if version exists in CHANGELOG
   - Parse `[Unreleased]` section for manual entries
   - Generate changelog from conventional commits since last tag
   - Merge manual and auto-generated entries (manual takes priority)
   - Update package.json and package-lock.json to tag version
   - Update CHANGELOG.md with merged release notes
   - Commit changes (if any)
   - Build the extension
   - Create GitHub release with generated notes
   - Publish to VS Code Marketplace
   - Publish to Open VSX Registry

### Manual Release (alternative)

If you prefer manual control:

1. Update version in `vscode/qodana/package.json`
2. Update `vscode/qodana/package-lock.json` accordingly
3. Update `vscode/qodana/CHANGELOG.md` following [Keep a Changelog](https://keepachangelog.com/) format
4. Commit changes: `git commit -m "Release v1.2.0"`
5. Create and push tag:
   ```bash
   git tag -a v1.2.0 -m "Release v1.2.0"
   git push origin v1.2.0
   ```

## Maintenance Scripts

### Update Qodana CLI

Updates the Qodana CLI version used by the extension:

```bash
node scripts/update-cli.js
```

This script:
- Fetches the latest CLI release from GitHub
- Downloads and parses checksums for all platforms
- Updates `vscode/qodana/src/core/cli/cli.json`

### Prepare Release

Automates version bumping and changelog generation:

```bash
node scripts/prepare-release.js 1.2.0
```

## CI/CD

The project uses GitHub Actions for:
- **Qodana Scans**: Automated code quality checks (JVM and JS)
- **Build & Test**: Multi-platform builds and tests (macOS, Linux, Windows)
- **Release**: Automated publishing on tag push
- **Dependabot**: Automated dependency updates

## Issue Tracking

Issues are tracked in [YouTrack](https://youtrack.jetbrains.com/issues/QD). When creating commits related to issues, include the issue ID in the commit message (e.g., `QD-14520`).
