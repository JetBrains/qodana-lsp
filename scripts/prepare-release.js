const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const PACKAGE_JSON_PATH = path.join(__dirname, "../vscode/qodana/package.json");
const PACKAGE_LOCK_PATH = path.join(__dirname, "../vscode/qodana/package-lock.json");
const CHANGELOG_PATH = path.join(__dirname, "../vscode/qodana/CHANGELOG.md");
const REGRESSIONS_TEST_PATH = path.join(__dirname, "../vscode/qodana/src/test/suite/regressions.test.ts");

function getCurrentVersion() {
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf-8"));
    return packageJson.version;
}

function getPackageLockVersion() {
    const packageLock = JSON.parse(fs.readFileSync(PACKAGE_LOCK_PATH, "utf-8"));
    return packageLock.version;
}

function getRegressionsTestVersion() {
    const content = fs.readFileSync(REGRESSIONS_TEST_PATH, "utf-8");
    const match = content.match(/version:\s*['"]([^'"]+)['"]/);
    return match ? match[1] : null;
}

function getLatestTag() {
    try {
        return execSync("git describe --tags --abbrev=0", { encoding: "utf-8" }).trim();
    } catch {
        // No tags yet
        return null;
    }
}

function getCommitsSinceTag(tag) {
    const range = tag ? `${tag}..HEAD` : "HEAD";
    try {
        const log = execSync(`git log ${range} --pretty=format:"%s|||%H"`, { encoding: "utf-8" });
        return log.split("\n").filter(line => line.trim()).map(line => {
            const [message, hash] = line.split("|||");
            return { message, hash };
        });
    } catch {
        return [];
    }
}

function parseConventionalCommit(message) {
    // Match: type(scope): description or type: description
    const match = message.match(/^(\w+)(?:\(([^)]+)\))?: (.+)$/);
    if (!match) return null;

    const [, type, scope, description] = match;
    return { type, scope, description };
}

function generateChangelogSections(commits) {
    const typeToSection = {
        feat: "### Added",
        fix: "### Fixed",
        perf: "### Changed",
        refactor: "### Changed",
        chore: "### Changed",
        docs: "### Changed"
    };

    const sections = {
        "### Added": [],
        "### Changed": [],
        "### Fixed": []
    };

    for (const commit of commits) {
        const parsed = parseConventionalCommit(commit.message);
        if (!parsed) continue;

        const sectionName = typeToSection[parsed.type];
        if (!sectionName) continue;

        // Extract ticket ID if present
        const ticketMatch = commit.message.match(/\(?(QD-\d+)\)?/);

        // Format: QD-XXXXX: description
        let entry;
        if (ticketMatch) {
            // Capitalize first letter of description
            const desc = parsed.description.charAt(0).toUpperCase() + parsed.description.slice(1);
            entry = `- ${ticketMatch[1]}: ${desc}.`;
        } else {
            // No ticket, just description
            const desc = parsed.description.charAt(0).toUpperCase() + parsed.description.slice(1);
            entry = `- ${desc}.`;
        }

        sections[sectionName].push(entry);
    }

    return sections;
}

function updatePackageJson(version) {
    const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf-8"));
    packageJson.version = version;
    fs.writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(packageJson, null, 2) + "\n");
    console.log(`✅ Updated ${PACKAGE_JSON_PATH} to version ${version}`);
}

function updatePackageLock(version) {
    const packageLock = JSON.parse(fs.readFileSync(PACKAGE_LOCK_PATH, "utf-8"));
    packageLock.version = version;
    if (packageLock.packages && packageLock.packages[""]) {
        packageLock.packages[""].version = version;
    }
    fs.writeFileSync(PACKAGE_LOCK_PATH, JSON.stringify(packageLock, null, 2) + "\n");
    console.log(`✅ Updated ${PACKAGE_LOCK_PATH} to version ${version}`);
}

function updateRegressionsTest(version) {
    let content = fs.readFileSync(REGRESSIONS_TEST_PATH, "utf-8");
    // Replace version in mock: version: '1.2.3' -> version: '1.2.4'
    const versionPattern = /(version:\s*['"])[\d.]+(['"]\s*,)/;
    const updated = content.replace(versionPattern, `$1${version}$2`);
    fs.writeFileSync(REGRESSIONS_TEST_PATH, updated);
    console.log(`✅ Updated ${REGRESSIONS_TEST_PATH} to version ${version}`);
}

function parseUnreleasedSection(content) {
    const sections = {
        "### Added": [],
        "### Changed": [],
        "### Fixed": []
    };

    const unreleasedMatch = content.match(/## \[Unreleased\]([\s\S]*?)(?=\n## \[|$)/);
    if (!unreleasedMatch) return sections;

    const unreleasedContent = unreleasedMatch[1];
    let currentSection = null;

    const lines = unreleasedContent.split("\n");
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("### ")) {
            currentSection = trimmed;
        } else if (trimmed.startsWith("- ") && currentSection && sections[currentSection]) {
            sections[currentSection].push(trimmed);
        }
    }

    return sections;
}

function extractTicketId(text) {
    const match = text.match(/\(?(QD-\d+)\)?/);
    return match ? match[1] : null;
}

function mergeChangelogSections(manualSections, autoSections) {
    const merged = {
        "### Added": [],
        "### Changed": [],
        "### Fixed": []
    };

    // Collect all ticket IDs from auto-generated entries
    const autoTicketIds = new Set();
    for (const items of Object.values(autoSections)) {
        for (const item of items) {
            const ticketId = extractTicketId(item);
            if (ticketId) {
                autoTicketIds.add(ticketId);
            }
        }
    }

    // Add all manual entries first (they have priority)
    for (const [section, items] of Object.entries(manualSections)) {
        for (const item of items) {
            merged[section].push(item);
        }
    }

    // Add auto-generated entries only if their ticket is NOT in manual entries
    for (const [section, items] of Object.entries(autoSections)) {
        for (const item of items) {
            const ticketId = extractTicketId(item);
            // Check if this ticket exists in ANY manual entry
            let foundInManual = false;
            if (ticketId) {
                for (const manualItems of Object.values(manualSections)) {
                    if (manualItems.some(manualItem => extractTicketId(manualItem) === ticketId)) {
                        foundInManual = true;
                        break;
                    }
                }
            }

            // Only add if not found in manual or no ticket ID
            if (!foundInManual) {
                merged[section].push(item);
            }
        }
    }

    return merged;
}

function checkVersionExists(version) {
    const content = fs.readFileSync(CHANGELOG_PATH, "utf-8");
    const versionPattern = new RegExp(`## \\[${version.replace(/\./g, "\\.")}\\]`);
    return versionPattern.test(content);
}

function updateChangelog(version, autoSections) {
    let content = fs.readFileSync(CHANGELOG_PATH, "utf-8");

    // Check if version already exists
    if (checkVersionExists(version)) {
        console.log(`⚠️  Version ${version} already exists in CHANGELOG, skipping update`);
        return;
    }

    // Parse existing [Unreleased] section
    const manualSections = parseUnreleasedSection(content);

    // Merge manual and auto-generated sections
    const mergedSections = mergeChangelogSections(manualSections, autoSections);

    // Generate new version entry
    const today = new Date().toISOString().split("T")[0];
    let newEntry = `## [${version}] - ${today}\n`;

    const order = ["### Added", "### Changed", "### Fixed"];
    for (const sectionName of order) {
        const items = mergedSections[sectionName];
        if (items.length > 0) {
            newEntry += `\n${sectionName}\n\n`;
            // Deduplicate
            const uniqueItems = [...new Set(items)];
            newEntry += uniqueItems.join("\n") + "\n";
        }
    }

    // Replace [Unreleased] section with empty one and add new version
    const unreleasedMatch = content.match(/## \[Unreleased\]([\s\S]*?)(?=\n## \[|$)/);
    if (unreleasedMatch) {
        const replaceStart = unreleasedMatch.index;
        const replaceEnd = replaceStart + unreleasedMatch[0].length;
        const before = content.slice(0, replaceStart);
        const after = content.slice(replaceEnd);
        content = before + "## [Unreleased]\n\n" + newEntry + "\n" + after;
    } else {
        // No [Unreleased], add both
        const headerMatch = content.match(/# Change Log\n\n.*?\n\n/s);
        if (headerMatch) {
            const insertPos = headerMatch.index + headerMatch[0].length;
            content = content.slice(0, insertPos) + "## [Unreleased]\n\n" + newEntry + "\n\n" + content.slice(insertPos);
        }
    }

    fs.writeFileSync(CHANGELOG_PATH, content);
    console.log(`✅ Updated ${CHANGELOG_PATH} with version ${version}`);
}

function main() {
    const args = process.argv.slice(2);
    if (args.length !== 1) {
        console.error("Usage: node prepare-release.js <version>");
        console.error("Example: node prepare-release.js 1.2.0");
        process.exit(1);
    }

    const newVersion = args[0];
    const packageJsonVersion = getCurrentVersion();
    const packageLockVersion = getPackageLockVersion();
    const testVersion = getRegressionsTestVersion();

    console.log(`Current versions:`);
    console.log(`  package.json: ${packageJsonVersion}`);
    console.log(`  package-lock.json: ${packageLockVersion}`);
    console.log(`  regressions.test.ts: ${testVersion}`);
    console.log(`New version: ${newVersion}`);

    // Get latest tag
    const latestTag = getLatestTag();
    console.log(`Latest tag: ${latestTag || "(none)"}`);

    // Check if version already exists in CHANGELOG
    if (checkVersionExists(newVersion)) {
        console.log(`⚠️  Version ${newVersion} already exists in CHANGELOG`);
        console.log("Only updating version files if needed...");

        let updated = false;
        if (packageJsonVersion !== newVersion) {
            updatePackageJson(newVersion);
            updated = true;
        }
        if (packageLockVersion !== newVersion) {
            updatePackageLock(newVersion);
            updated = true;
        }
        if (testVersion !== newVersion) {
            updateRegressionsTest(newVersion);
            updated = true;
        }

        if (!updated) {
            console.log("✅ All files already at version " + newVersion);
        }
        return;
    }

    // Get commits since last tag
    const commits = getCommitsSinceTag(latestTag);
    console.log(`Found ${commits.length} commits since ${latestTag || "beginning"}`);

    // Generate changelog sections from commits
    const autoSections = generateChangelogSections(commits);

    const autoCount = Object.values(autoSections).reduce((sum, items) => sum + items.length, 0);
    console.log(`\n📝 Generated ${autoCount} changelog entries from commits`);

    // Parse manual entries from [Unreleased]
    const content = fs.readFileSync(CHANGELOG_PATH, "utf-8");
    const manualSections = parseUnreleasedSection(content);
    const manualCount = Object.values(manualSections).reduce((sum, items) => sum + items.length, 0);

    if (manualCount > 0) {
        console.log(`📝 Found ${manualCount} manual entries in [Unreleased]`);
    }

    // Check if we have any changes at all
    if (autoCount === 0 && manualCount === 0) {
        console.log("\n⚠️  No changes found (neither conventional commits nor manual entries)");
        console.log("Skipping CHANGELOG update");

        // Still update version files if needed
        let updated = false;
        if (packageJsonVersion !== newVersion) {
            updatePackageJson(newVersion);
            updated = true;
        }
        if (packageLockVersion !== newVersion) {
            updatePackageLock(newVersion);
            updated = true;
        }
        if (testVersion !== newVersion) {
            updateRegressionsTest(newVersion);
            updated = true;
        }

        if (updated) {
            console.log("\n✅ Updated version files only");
        } else {
            console.log("✅ Nothing to update");
        }
        return;
    }

    // Update files
    let updated = false;
    if (packageJsonVersion !== newVersion) {
        updatePackageJson(newVersion);
        updated = true;
    }
    if (packageLockVersion !== newVersion) {
        updatePackageLock(newVersion);
        updated = true;
    }
    if (testVersion !== newVersion) {
        updateRegressionsTest(newVersion);
        updated = true;
    }

    if (!updated) {
        console.log("✅ All version files already at version " + newVersion);
    }

    updateChangelog(newVersion, autoSections);

    console.log("\n✅ Release preparation complete!");
    console.log("\nFiles updated:");
    console.log("- " + PACKAGE_JSON_PATH);
    console.log("- " + PACKAGE_LOCK_PATH);
    console.log("- " + REGRESSIONS_TEST_PATH);
    console.log("- " + CHANGELOG_PATH);
}

main();
