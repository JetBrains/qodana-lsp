import * as vscode from "vscode";
import axios from 'axios';
import * as fs from 'fs';
import { failedToObtainData, noReportsFound, failedToObtainReportId, noFilesFound, failedToObtainReport, failedToDownloadReport, projectIdIsNotValid, failedToDownloadReportWithId, YES, NEW_REPORT_AVAILABLE, NO } from "../messages";
import { apiUrl, isValidString } from "../defaults";
import telemetry from "../telemetry";
import { Events } from "../events";
import { WS_OPENED_REPORT, WS_REPORT_ID } from "../config";

export async function openReportById(projectId: string, reportId: string, context: vscode.ExtensionContext, token: string) {
    let handlerReportPath = await getReportFileById(context, token, projectId, reportId);
    if (handlerReportPath) {
        // no need to ask user confirmation, since it is triggered by URL handler
        await openReportByPath(handlerReportPath, reportId, false, context);
    }
}

export async function openReportByTimer(projectId: string, context: vscode.ExtensionContext, token: string) {
    // need to ask user confirmation if opened report differs from the latest report
    let latestReportId = await getReportId(token, projectId as string);
    if (!latestReportId) {
        return undefined;
    }
    await openReportById(projectId, latestReportId, context, token);
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

/* eslint-disable @typescript-eslint/naming-convention */

// fetch the report id using the token
async function getReportId(token: string, projectId: string): Promise<string | undefined> {
    if (!isValidString(projectId)) {
        telemetry.errorReceived('#getReportId invalid project id');
        vscode.window.showErrorMessage(projectIdIsNotValid(projectId));
        return undefined;
    }
    // get report id from the server
    let pagination = {
        offset: 0,
        limit: 1,
        states: ''
    };
    pagination['states'] = 'UPLOADED,PROCESSED,PINNED';
    const config = {
        url: (new URL(`v1/projects/${projectId}/timeline`, apiUrl())).toString(),
        method: 'get',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        },
        data: pagination
    };
    let res = await axios(config);
    if (!res.data) {
        vscode.window.showErrorMessage(failedToObtainData(projectId));
        telemetry.errorReceived('#getReportId no data');
        return undefined;
    }
    let timeline = res.data as PaginatedResponse<QodanaCloudReportResponse>;
    if (!timeline.items || timeline.items.length === 0) {
        vscode.window.showInformationMessage(noReportsFound(projectId));
        telemetry.errorReceived('#getReportId no reports');
        return undefined;
    }
    return timeline.items[0].reportId;
}

// fetch the report file to the temporary location
async function fetchReportFileUrl(token: string, reportId: string, projectId: string): Promise<string | undefined> {
    try {
        if (!isValidString(projectId)) {
            telemetry.errorReceived('#fetchReportFileUrl invalid project id');
            vscode.window.showErrorMessage(projectIdIsNotValid(projectId));
            return undefined;
        }
        const config = {
            url: (new URL(`v1/reports/${reportId}/files?${new URLSearchParams({ paths: 'qodana.sarif.json' })}`, apiUrl())).toString(),
            method: 'get',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        };
        let res = await axios(config);
        if (!res.data) {
            vscode.window.showErrorMessage(failedToObtainReportId(reportId, projectId));
            telemetry.errorReceived('#fetchReportFileUrl no report id');
            return undefined;
        }
        let files = res.data as Files<QodanaCloudFileResponse>;
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

export async function getReportFileById(context: vscode.ExtensionContext, token: string, projectId: string, reportId: string): Promise<string | undefined> {
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
        let reportUrl = await fetchReportFileUrl(token, reportId, projectId);
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


interface PaginatedResponse<T> {
    items: T[];
    next: number | null;
}

interface QodanaCloudReportResponse {
    reportId: string;
}

interface Files<T> {
    files: T[];
}

interface QodanaCloudFileResponse {
    file: string;
    url: string;
}