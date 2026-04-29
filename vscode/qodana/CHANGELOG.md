# Change Log

All notable changes to the "qodana-code" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

### Added

- PKCE support for OAuth authentication (QD-13301).
- Support for Qodana for Rust (QDRST) linter (QD-13871).
- Automated CLI update script (`scripts/update-cli.js`) (QD-14520).
- Automated release preparation script (`scripts/prepare-release.js`) (QD-14520).
- Dependabot configuration for GitHub Actions and npm dependencies (QD-14520).
- CONTRIBUTING.md with release process documentation (QD-14520).

### Changed

- Status bar behaviour to open Qodana tab on click.
- Update Qodana CLI to 2026.1.0 (QD-14515).
- Update Qodana GitHub Action to v2026.1 (QD-14515).

### Fixed

- Fix latest report opening on "Open in VS Code" action (QD-13470).

## [1.1.5] - 2024-10-01

### Added

- Publishing to Open VSX Registry in addition to VS Code Marketplace (QD-13069).
- C++ and Ruby linters to EAP suggestions.
- Warning to qodana.yaml template (QD-12365).

### Changed

- Updated linter field value in generated qodana.yaml.
- Bump Qodana CLI and Qodana-related workflows.

## [1.1.4] - 2024-09-15

### Changed

- Bump linters and CLI to 2025.2.
- Bump Node.JS version.

### Fixed

- Handle result-dir path for Windows.
- Fix CLI call on Windows (also fix tests).
- Remove user root parameter.

## [1.1.3] - 2024-08-01

### Changed

- Bump linters and CLI to 2025.1.
- Bump LSP version.

## [1.1.2] - 2024-07-01

### Changed

- Bump Qodana CLI to 2024.2 for local runs.
- Bump upload-artifacts to v4.

### Fixed

- QD-10124: Fix qodana.yaml unmarshal problem.
- QD-10124: CLI now asks for update if new version is found.

### Security

- Bump axios from 1.6.0 to 1.7.4.
- Bump path-to-regexp from 1.8.0 to 1.9.0.
- Bump micromatch from 4.0.5 to 4.0.8.

## [1.1.1] - 2024-04-15

### Fixed

- Add missing constants file to fix UI.

## [1.1.0] - 2024-04-01

### Added

- Local run capability - ability to run Qodana locally from VS Code.
- Support for self-hosted Qodana instances (QD-9092).
- Possibility to link projects and open reports.
- Close report button.
- Username to Settings view.
- QODANA_TOKEN substitution for local runs.

### Changed

- Use webViews instead of WelcomeViews for panels.
- Refactored Authorization and API.
- Language server restart logic improvements.
- UI/UX improvements.
- Move command names to constants.

### Fixed

- QD-9035: Handle case when no workspace is opened for local run.
- QD-9033: Remove extra notification when auth failed.
- QD-9034: Fix redirection link for self-hosted instances without https prefix.
- Fix close report for linked project.
- Fix local run: non-existing file, locate yaml in the root.
- Fix projects retrieval by git (including SSH).
- Fix report toggling.
- Fix Windows CLI executable extension.
- Fix restart logic for language server to avoid loading report twice.

### Security

- Bump vulnerable dependencies (follow-redirects).

## [1.0.1] - 2023-11-14

### Added

- Ability to turn off issues from the baseline.
- Ability to download JBR to run the extension.
- README for VS Code extension with GIF animation.

### Fixed

- Open in VSCode opens the corresponding report from Qodana Cloud.

### Changed

- Upgrade dependencies: axios 1.6.0.

## [1.0.0] - 2023-09-28

- Initial release.