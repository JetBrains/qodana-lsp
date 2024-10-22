import { checksum, version } from './cli.json';
import * as vscode from 'vscode';
import { createHash } from 'crypto';
import { downloadFile } from '../report';
import { CLI_DOWNLOAD_CONFIRMATION, NO, YES, cliChecksumMismatch, cliSuccessfullyExtracted, cliUnsupportedArch, cliUnsupportedPlatform, failedToDownloadCli, failedToExtractCli } from '../messages';
import * as fs from 'fs';
import * as path from 'path';
import telemetry from '../telemetry';
import * as AdmZip from 'adm-zip';
import {GS_CLI_SETTING, GS_VER_SETTING} from '../config';

const SUPPORTED_PLATFORMS = ['windows', 'linux', 'darwin'];
const SUPPORTED_ARCHS = ['x86_64', 'arm64'];
const EXECUTABLE = 'qodana';

export async function getCli(context: vscode.ExtensionContext): Promise<string | undefined> {
    let cliFromSettings = context.globalState.get<string | undefined>(GS_CLI_SETTING);
    let cliVerFromSettings = context.globalState.get<string | undefined>(GS_VER_SETTING);
    if (cliFromSettings) {
        try {
            await fs.promises.access(cliFromSettings);
        } catch (e) {
            await context.globalState.update(GS_VER_SETTING, undefined);
            await context.globalState.update(GS_CLI_SETTING, undefined);
            cliFromSettings = undefined;
        }
    }
    if (cliFromSettings && cliVerFromSettings === version) {
        return cliFromSettings;
    }

    let decision = await vscode.window.showErrorMessage(CLI_DOWNLOAD_CONFIRMATION, YES, NO);
    if (decision === YES) {
        let downloadedCliArchDir = path.join(context.globalStorageUri.fsPath, Math.random().toString(36).substring(7));
        let downloadedCliDir = path.join(context.globalStorageUri.fsPath, Math.random().toString(36).substring(7));
        await fs.promises.mkdir(downloadedCliArchDir, { recursive: true });
        await fs.promises.mkdir(downloadedCliDir, { recursive: true });
        let cli = await downloadAndUnpackCli(downloadedCliArchDir, downloadedCliDir);
        if (cli) {
            telemetry.cliDownloaded();
            await context.globalState.update(GS_VER_SETTING, version);
            await context.globalState.update(GS_CLI_SETTING, cli);
            vscode.window.showInformationMessage(cliSuccessfullyExtracted(cli));
            return cli;
        }
    } else if (cliFromSettings) {
        return cliFromSettings;
    }
    return undefined;
}

function getProcessArchName(): string {
    return process.arch === 'x64' ? 'x86_64' : 'arm64';
}

function getProcessPlatformName(): string {
    return process.platform === 'win32' ? 'windows' : process.platform;
}

function getQodanaSha256(arch: string, platform: string): string {
    switch (`${platform}_${arch}`) {
        case 'windows_x86_64':
            return checksum['windows_x86_64'];
        case 'windows_arm64':
            return checksum['windows_arm64'];
        case 'linux_x86_64':
            return checksum['linux_x86_64'];
        case 'linux_arm64':
            return checksum['linux_arm64'];
        case 'darwin_x86_64':
            return checksum['darwin_x86_64'];
        case 'darwin_arm64':
            return checksum['darwin_arm64'];
        default:
            throw new Error(`Qodana CLI does not exist for ${platform}_${arch}`);
    }
}

async function sha256sum(file: string): Promise<string> {
    const hash = createHash('sha256');
    let content = await fs.promises.readFile(file);
    hash.update(content);
    return hash.digest('hex');
}

async function computeExtractedCliPath(destPath: string): Promise<string | undefined> {
    let ret = path.join(destPath, EXECUTABLE);
    if (process.platform === 'win32') {
        ret += '.exe';
    }
    try {
        await fs.promises.access(ret);
        return ret;
    } catch (e) {
        return undefined;
    }
}

async function extractZip(zipPath: string, destPath: string): Promise<string> {
    try {
        const zip = new AdmZip(zipPath);
        zip.extractAllTo(destPath, true);
    } catch (e) {
        vscode.window.showErrorMessage(failedToExtractCli(zipPath) + `: ${e}`);
        telemetry.errorReceived('#extractZip exception');
    }
    return destPath;
}

async function extractTar(tarPath: string, destPath: string): Promise<string> {
    try {
        const tar = require('tar');
        await tar.x({
            file: tarPath,
            cwd: destPath,
        });
    } catch (e) {
        vscode.window.showErrorMessage(failedToExtractCli(tarPath) + `: ${e}`);
        telemetry.errorReceived('#extractTar exception');
    }
    return destPath;
}


export async function downloadAndUnpackCli(downloadedCliArchDir: string, downloadedCliDir: string): Promise<string | undefined> {
    const platform = getProcessPlatformName();
    const arch = getProcessArchName();
    const url = getQodanaUrl(arch, platform);
    const expectedChecksum = getQodanaSha256(arch, platform);
    if (!url) {
        return undefined;
    }
    // get file name from URL
    const fileName = url.split('/').pop();
    if (!fileName) {
        vscode.window.showErrorMessage(failedToDownloadCli(url)); // case that is not possible to happen
        return undefined;
    }
    const cliArchPath = await fetchCli(url, path.join(downloadedCliArchDir, fileName));
    if (!cliArchPath) {
        vscode.window.showErrorMessage(failedToDownloadCli(url));
        return undefined;
    }
    const actualChecksum = await sha256sum(cliArchPath);
    if (actualChecksum !== expectedChecksum) {
        vscode.window.showErrorMessage(cliChecksumMismatch(url));
        return undefined;
    }
    let extractRoot: string | undefined;
    if (process.platform === 'win32') {
        extractRoot = await extractZip(cliArchPath, downloadedCliDir);
    } else {
        extractRoot = await extractTar(cliArchPath, downloadedCliDir);
    }
    return await computeExtractedCliPath(extractRoot);
}

async function fetchCli(url: string, filePath: string): Promise<string | undefined> {
    try {
        return await downloadFile(url, filePath);
    } catch (e) {
        vscode.window.showErrorMessage(failedToDownloadCli(url) + `: ${e}`);
        telemetry.errorReceived('#fetchCli exception');
        return undefined;
    }
}

function getQodanaUrl(arch: string, platform: string): string | undefined {
    if (!SUPPORTED_PLATFORMS.includes(platform)) {
        vscode.window.showErrorMessage(cliUnsupportedPlatform(platform));
        return undefined;
    }
    if (!SUPPORTED_ARCHS.includes(arch)) {
        vscode.window.showErrorMessage(cliUnsupportedArch(arch));
        return undefined;
    }
    const archive = platform === 'windows' ? 'zip' : 'tar.gz';
    return `https://github.com/JetBrains/qodana-cli/releases/download/v${version}/qodana_${platform}_${arch}.${archive}`;
}