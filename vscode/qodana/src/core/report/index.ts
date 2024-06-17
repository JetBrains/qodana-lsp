import * as vscode from 'vscode';
import axios from 'axios';
import * as fs from 'fs';
import { noFilesFound, failedToObtainReport, failedToDownloadReport, failedToDownloadReportWithId, YES, NEW_REPORT_AVAILABLE, NO } from '../messages';
import telemetry from '../telemetry';
import { Events } from '../events';
import { WS_OPENED_REPORT, WS_REPORT_ID } from '../config';
import {Authorized} from '../auth';

export async function openReportById(projectId: string, reportId: string, context: vscode.ExtensionContext, authorized: Authorized) {
    let handlerReportPath = await getReportFileById(context, authorized, projectId, reportId);
    if (handlerReportPath) {
        // no need to ask user confirmation, since it is triggered by URL handler
        await openReportByPath(handlerReportPath, reportId, false, context);
    }
}

export async function openReportByProjectId(projectId: string, context: vscode.ExtensionContext, authorized: Authorized) {
    // need to ask user confirmation if opened report differs from the latest report
    let latestReportId = await authorized.qodanaCloudUserApi( (api) => {
        return api.getReportId(projectId as string);
    });
    if (!latestReportId) {
        return undefined;
    }
    await openReportById(projectId, latestReportId, context, authorized);
}

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

// fetch the report file to the temporary location
async function fetchReportFileUrl(authorized: Authorized, reportId: string, projectId: string): Promise<string | undefined> {
    try {
        let files = await authorized.qodanaCloudUserApi((api) => {
            return api.getReport(reportId, projectId);
        });
        if (files === undefined) {
            return undefined;
        }
        if (files.files.length === 0) {
            vscode.window.showErrorMessage(noFilesFound(reportId, projectId));
            telemetry.errorReceived('#fetchReportFileUrl no files');
            return undefined;
        }
        return files.files[0].url;
    } catch (e) {
        vscode.window.showErrorMessage(failedToObtainReport(reportId, projectId));
        telemetry.errorReceived('#fetchReportFileUrl exception');
        return undefined;
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

    let receivedBytes = 0;

    return vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Downloading File',
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
}

async function fetchReportFile(context: vscode.ExtensionContext, reportId: string, projectId: string, url: string): Promise<string | undefined> {
    try {
        let filePath = await reportPath(context, reportId);
        return await downloadFile(url, filePath);
    } catch (e) {
        vscode.window.showErrorMessage(failedToDownloadReport(projectId) + `: ${e}`);
        telemetry.errorReceived('#fetchReportFile exception');
        return undefined;
    }
}

export async function getReportFileById(context: vscode.ExtensionContext, authorized: Authorized, projectId: string, reportId: string): Promise<string | undefined> {
    try {
        // compare with the stored report id
        let storedReportId = context.workspaceState.get(WS_REPORT_ID);
        if (storedReportId === reportId) {
            // return the stored file path
            let path = await reportPath(context, reportId);
            // if file exists
            try {
                await fs.promises.access(path);
                return path;
            } catch (e) {
                // report got deleted, need to download it again
            }
        }
        // fetch the report file url for the new report id
        let reportUrl = await fetchReportFileUrl(authorized, reportId, projectId);
        if (!reportUrl) {
            return undefined;
        }
        // fetch the file for that report id and url
        let newReportPath = await fetchReportFile(context, reportId, projectId, reportUrl as string);
        if (!newReportPath) {
            vscode.window.showErrorMessage(failedToDownloadReport(projectId));
            return undefined;
        }
        // store the report id 
        await context.workspaceState.update(WS_REPORT_ID, reportId);
        if (storedReportId) {
            // remove old report
            let storedReportPath = await reportPath(context, storedReportId as string);
            // todo turn into async code
            try {
                let stat = await fs.promises.stat(storedReportPath);
                if (stat.isFile()) {
                    await fs.promises.unlink(storedReportPath);
                }
            } catch (e) {
                // ignore
            }
        }
        return newReportPath;
    } catch (e) {
        vscode.window.showErrorMessage(failedToDownloadReportWithId(projectId, reportId) + `: ${e}`);
        telemetry.errorReceived('#getReportById exception');
        return undefined;
    }
}