import axios from 'axios';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { DOWNLOAD_CONFIRMATION, NO, YES, failedToDownloadJbr, successfullyExtracted } from '../messages';
import telemetry from '../telemetry';
import * as tar from 'tar';
import * as os from 'os';
import * as path from 'path';
import { reportPath } from '../report';


export async function getJbrReleases() {
    let data = await axios.get('https://api.github.com/repos/JetBrains/JetBrainsRuntime/releases/127486177'); // 13.11.2023
    let body = data.data.body;
    return parseData(body);
}

export async function fetchJbr(url: string, filePath: string): Promise<string | undefined> {
    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
        });
        const writer = fs.createWriteStream(filePath);
        const totalBytes = parseInt(response.headers['content-length']);

        let receivedBytes = 0;

        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Downloading File",
            cancellable: false
        }, (progress) => {
            // The event 'data' will be emitted when there is data available.
            response.data.on('data', (chunk: any) => {
                receivedBytes += chunk.length;
                let percentage = Math.floor((receivedBytes / totalBytes) * 100).toString() + '%';
                progress.report({ message: percentage });
            });

            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => { resolve(filePath); });
                writer.on('error', reject);
            });
        });
    } catch (e) {
        vscode.window.showErrorMessage(failedToDownloadJbr(url) + `: ${e}`);
        telemetry.errorReceived('#fetchReportFile exception');
        return undefined;
    }
}

export async function extractJbr(filePath: string, releaseName: string, extractPath: string): Promise<string | undefined> {
    try {
        await tar.x({
            file: filePath,
            cwd: extractPath
        });
        let dirName = releaseName.replace('.tar.gz', '');
        if (getOsAndArch().osType === 'osx') {
            return path.join(extractPath, dirName, 'Contents', 'Home', 'bin', 'java');
        }
        return path.join(extractPath, dirName, 'bin', 'java');
    } catch (e) {
        vscode.window.showErrorMessage(failedToDownloadJbr(filePath) + `: ${e}`);
        telemetry.errorReceived('#extractJbr exception');
    }
    return undefined;
}

export async function getMatchingReleaseUrl(): Promise<Release | undefined> {
    let { osType, osArch } = getOsAndArch();
    let releases = await getJbrReleases();
    let release = releases.get(`${osType}-${osArch}`);
    if (release) {
        return release;
    }
}

export function getOsAndArch() {
    let osType: string;
    switch (os.type()) {
        case "Linux":
            osType = "linux";
            break;
        case "Darwin":
            osType = "osx";
            break;
        default:
            osType = "windows";
            break;
    }
    let osArch: string;
    switch (os.arch()) {
        case "arm64":
            osArch = "aarch64";
            break;
        default:
            osArch = "x64";
            break;
    }

    return { osType, osArch };
}

export async function downloadAndUnpackJbr(dir: string): Promise<string | undefined> {
    let release = await getMatchingReleaseUrl();
    if (!release) {
        return undefined;
    }
    let fetchedRelease = await fetchJbr(release!.fileUrl, `${dir}/jbr.tar.gz`);
    if (!fetchedRelease) {
        return undefined;
    }
    let pathToExtract = `${dir}/jbr`;
    await fs.promises.mkdir(pathToExtract);
    let extractedPath = await extractJbr(fetchedRelease, release.fileName, pathToExtract);
    await fs.promises.unlink(fetchedRelease);
    if (extractedPath) {
        try {
            await fs.promises.access(extractedPath);
            return extractedPath;
        } catch (e) {
            vscode.window.showErrorMessage(failedToDownloadJbr(extractedPath) + `: ${e}`);
            telemetry.errorReceived('#downloadAndUnpack exception');
        }
    }
}

export function getJavaExecutablePath(): string | null {
    let cmd: String;
    if (os.platform() === 'win32') {
        cmd = "java -XshowSettings:properties -version 2>&1 | findstr \"java.home\"";
    } else {
        cmd = "java -XshowSettings:properties -version 2>&1 > /dev/null | grep 'java.home'";
    }
    let javaHome: string | null = null;
    try {
        javaHome = require('child_process').execSync(cmd).toString().split('=')[1].trim();
    } catch (error) {
        return null;
    }
    if (javaHome) {
        if (os.platform() === 'win32') {
            cmd = "java -XshowSettings:properties -version 2>&1 | findstr \"java.class.version\"";
        } else {
            cmd = "java -XshowSettings:properties -version 2>&1 > /dev/null | grep 'java.class.version'";
        }
        let javaClassVersion: string | null = null;
        try {
            javaClassVersion = require('child_process').execSync(cmd).toString().split('=')[1].trim();
        } catch (error) {
            telemetry.errorReceived('#getJavaExecutablePath exception (getting java class version)');
            console.log("Failed to get JAVA_HOME. " + (error));
        }

        if (javaClassVersion) {
            let version = javaClassVersion.split('.')[0];
            if (version) {
                if (parseInt(version) < 55) {
                    return null;
                }
            }
        } else {
            return null;
        }

        return path.join(javaHome, 'bin', 'java' + (os.platform() === 'win32' ? '.exe' : ''));
    }
    return null;
}

export async function getJavaForExecution(context: vscode.ExtensionContext): Promise<string | undefined> {
    try {
        let javaFromSettings = context.workspaceState.get<string | undefined>('javaExecutablePath');
        if (javaFromSettings) {
            try {
                await fs.promises.access(javaFromSettings);
                return javaFromSettings;
            } catch (e) {
                await context.globalState.update('javaExecutablePath', undefined);
            }
        }
        let localJava = getJavaExecutablePath();
        if (localJava) {
            await context.globalState.update('javaExecutablePath', localJava);
            return localJava;
        }
        let decision = await vscode.window.showErrorMessage(DOWNLOAD_CONFIRMATION, YES, NO);
        if (decision === YES) {
            let downloadedJbrDir = await reportPath(context, Math.random().toString(36).substring(7));
            await fs.promises.mkdir(downloadedJbrDir, { recursive: true });
            let java = await downloadAndUnpackJbr(downloadedJbrDir);
            if (java) {
                telemetry.jbrDownloaded();
                await context.globalState.update('javaExecutablePath', java);
                vscode.window.showInformationMessage(successfullyExtracted(java));
                return java;
            }
        }
    } catch (e) {
        telemetry.errorReceived('#getJavaForExecution exception');
        return undefined;
    }
}


function parseData(data: string) {
    // regular expression to find markdown table row data
    const re = /\| (.*?) \| .*? \| \[(.*?)\]\((.*?)\)/g;
    let match;
    // create mutable map of platform+arch to file name and file url
    const map = new Map<string, Release>();
    while ((match = re.exec(data)) !== null) {

        const platformArch = match[1].trim(); // platform+arch
        const fileName = match[2]; // file name
        const fileUrl = match[3]; // file url
        if (!fileUrl.startsWith("https://cache-redirector.jetbrains.com/intellij-jbr")) {
            continue;
        }
        if (!fileName.startsWith('jbr-') || !fileName.endsWith('.tar.gz')) {
            continue;
        }
        if (fileName.indexOf('_jcef') !== -1 || fileName.indexOf('debug') !== -1 || fileName.indexOf('_diz') !== -1) {
            continue;
        }
        map.set(platformArch, { fileName, fileUrl });
    }
    return map;
}

interface Release {
    fileName: string;
    fileUrl: string;
}