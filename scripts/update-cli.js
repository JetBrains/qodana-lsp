const fs = require("fs");
const https = require("https");
const path = require("path");

const CLI_JSON_PATH = path.join(__dirname, "../vscode/qodana/src/core/cli/cli.json");

function downloadFile(url) {
    return new Promise((resolve, reject) => {
        https.get(url, response => {
            if (response.statusCode === 200) {
                const chunks = [];
                response.on("data", chunk => chunks.push(chunk));
                response.on("end", () => resolve(Buffer.concat(chunks)));
            } else if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                downloadFile(response.headers.location).then(resolve).catch(reject);
            } else {
                reject(new Error(`Failed to download file. Status code: ${response.statusCode}`));
            }
        }).on("error", reject);
    });
}

function makeRequest(options) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => {
                data += chunk;
            });
            res.on("end", () => {
                if (res.statusCode >= 200 && res.statusCode <= 299) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`Request failed with status code ${res.statusCode}`));
                }
            });
        });

        req.on("error", (error) => {
            reject(error);
        });

        req.end();
    });
}

async function getLatestRelease() {
    try {
        const options = {
            hostname: "api.github.com",
            path: `/repos/jetbrains/qodana-cli/releases/latest`,
            headers: {
                "User-Agent": "request",
                "Accept": "application/vnd.github.v3+json"
            }
        };

        const release = await makeRequest(options);
        return release.tag_name.substring(1); // Remove 'v' prefix
    } catch (error) {
        console.error("An error occurred:", error);
        throw error;
    }
}

function updateCliJson(version, checksums) {
    const cliJson = JSON.parse(fs.readFileSync(CLI_JSON_PATH, "utf-8"));

    // Update version
    cliJson.version = version;

    // Update checksums
    for (const {platform, arch, checksum} of checksums) {
        const key = `${platform}_${arch}`;
        cliJson.checksum[key] = checksum;
    }

    fs.writeFileSync(CLI_JSON_PATH, JSON.stringify(cliJson, null, 2));
    console.log(`✅ Updated ${CLI_JSON_PATH}`);
}

async function main() {
    try {
        const cliJson = JSON.parse(fs.readFileSync(CLI_JSON_PATH, "utf-8"));
        const currentVersion = cliJson.version;
        console.log("Current CLI version:", currentVersion);

        const latestVersion = await getLatestRelease();
        console.log("Latest CLI version:", latestVersion);

        if (currentVersion === latestVersion) {
            console.log("✅ Already up to date");
            return;
        }

        console.log(`📦 Updating from ${currentVersion} to ${latestVersion}...`);

        // Download checksums.txt from GitHub release
        console.log("📥 Downloading checksums.txt...");
        const checksumsUrl = `https://github.com/jetbrains/qodana-cli/releases/download/v${latestVersion}/checksums.txt`;
        const checksumsData = await downloadFile(checksumsUrl);
        const checksumsText = checksumsData.toString();

        // Parse checksums
        const checksums = [];
        const lines = checksumsText.split("\n");
        for (const line of lines) {
            const match = line.match(/^([0-9a-f]{64})\s+qodana_(\w+)_(\w+)\.(tar\.gz|zip)$/);
            if (match) {
                const [, checksum, platform, arch] = match;
                checksums.push({platform, arch, checksum});
            }
        }

        console.log(`✅ Found ${checksums.length} checksums`);

        if (checksums.length !== 6) {
            throw new Error(`Expected 6 checksums, got ${checksums.length}`);
        }

        // Update cli.json
        updateCliJson(latestVersion, checksums);

        console.log("✅ Update complete!");
        console.log("\nNext steps:");
        console.log("1. Review the changes");
        console.log("2. Commit and push to a new branch");
        console.log("3. Create a PR");

    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
}

main();
