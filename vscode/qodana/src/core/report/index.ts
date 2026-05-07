import * as vscode from 'vscode';
import axios from 'axios';
import * as fs from 'fs';
import { YES, NEW_REPORT_AVAILABLE, NO } from '../messages';
import { Events } from '../events';
import { WS_OPENED_REPORT } from '../config';

export async function openReportByPath(path: string, reportId: string, confirmation: boolean, context: vscode.ExtensionContext) {
    let openedReport = context.workspaceState.get(WS_OPENED_REPORT);
    if (!openedReport || openedReport !== path) {
        // no report opened or different report opened
        if (confirmation && openedReport) {
            let answer = await vscode.window.showInformationMessage(NEW_REPORT_AVAILABLE, YES, NO);
            if (answer !== YES) {
                return;
            }
        }
        Events.instance.fireReportFile({ reportFile: path, reportId: reportId });
    }
}

export async function reportPath(context: vscode.ExtensionContext, reportId: string): Promise<string> {
    let pluginStoragePath: string = context.globalStorageUri.fsPath;
    let storageUri = context.storageUri;
    if (storageUri) {
        pluginStoragePath = storageUri.fsPath;
    }
    try {
        await fs.promises.access(pluginStoragePath);
    } catch (e) {
        await fs.promises.mkdir(pluginStoragePath);
    }
    return `${pluginStoragePath}/${reportId}`;
}

export async function downloadFile(url: string, filePath: string): Promise<string | undefined> {
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
    });
    const writer = fs.createWriteStream(filePath);
    const totalBytes = parseInt(response.headers['content-length']);
    const knownSize = !isNaN(totalBytes) && totalBytes > 0;

    let receivedBytes = 0;

    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Downloading File',
        cancellable: false
    }, (progress) => {
        response.data.on('data', (chunk: any) => {
            receivedBytes += chunk.length;
            if (knownSize) {
                // sometimes actual size is greater than expected
                const currentPercentage = Math.min(100, Math.floor((receivedBytes / totalBytes) * 100));
                progress.report({ message: `${currentPercentage}%` });
            }
        });

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => { resolve(filePath); });
            writer.on('error', reject);
        });
    });
}
