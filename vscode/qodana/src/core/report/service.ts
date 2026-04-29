import * as vscode from 'vscode';
import * as fs from 'fs';
import { Auth, Authorized } from '../auth';
import { downloadFile, openReportByPath, reportPath } from './index';
import {
    failedToDownloadReport,
    failedToDownloadReportWithId,
    failedToObtainReport,
    noFilesFound,
} from '../messages';
import telemetry from '../telemetry';
import { WS_REPORT_ID } from '../config';

export class ReportService {
    private readonly downloadsInProgress = new Map<string, Promise<string | undefined>>();

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly auth: Auth,
    ) {}

    async openReportById(projectId: string, reportId: string): Promise<void> {
        let authorized = this.auth.getAuthorized();
        if (!authorized) {
            telemetry.errorReceived('#openReportById not authorized');
            return;
        }
        let filePath = await this.getReportFileById(authorized, projectId, reportId);
        if (filePath) {
            await openReportByPath(filePath, reportId, false, this.context);
        }
    }

    async openReportByProjectId(projectId: string): Promise<void> {
        let authorized = this.auth.getAuthorized();
        if (!authorized) {
            telemetry.errorReceived('#openReportByProjectId not authorized');
            return;
        }
        let latestReportId = await authorized.qodanaCloudUserApi((api) => {
            return api.getReportId(projectId);
        });
        if (!latestReportId) {
            return;
        }
        await this.openReportById(projectId, latestReportId);
    }

    private getReportFileById(authorized: Authorized, projectId: string, reportId: string): Promise<string | undefined> {
        const key = `${projectId}/${reportId}`;
        const existing = this.downloadsInProgress.get(key);
        if (existing) {
            return existing;
        }
        const promise = this.fetchReportById(authorized, projectId, reportId)
            .finally(() => this.downloadsInProgress.delete(key));
        this.downloadsInProgress.set(key, promise);
        return promise;
    }

    private async fetchReportById(authorized: Authorized, projectId: string, reportId: string): Promise<string | undefined> {
        try {
            let storedReportId = this.context.workspaceState.get<string>(WS_REPORT_ID);
            if (storedReportId === reportId) {
                let path = await reportPath(this.context, reportId);
                try {
                    await fs.promises.access(path);
                    return path;
                } catch (e) {
                    // file deleted, re-download
                }
            }
            let reportUrl = await this.fetchReportFileUrl(authorized, reportId, projectId);
            if (!reportUrl) {
                return undefined;
            }
            let newReportPath = await this.fetchReportFile(reportId, projectId, reportUrl);
            if (!newReportPath) {
                vscode.window.showErrorMessage(failedToDownloadReport(projectId));
                return undefined;
            }
            // Fire-and-forget: the file is ready to use immediately; cache update and
            // old-file deletion don't need to block returning the path.
            this.cleanupAfterDownload(storedReportId, reportId).catch(() => { /* ignore */ });
            return newReportPath;
        } catch (e) {
            vscode.window.showErrorMessage(failedToDownloadReportWithId(projectId, reportId) + `: ${e}`);
            telemetry.errorReceived('#getReportById exception');
            return undefined;
        }
    }

    private async cleanupAfterDownload(oldReportId: string | undefined, newReportId: string): Promise<void> {
        await this.context.workspaceState.update(WS_REPORT_ID, newReportId);
        if (oldReportId) {
            try {
                let storedPath = await reportPath(this.context, oldReportId);
                let stat = await fs.promises.stat(storedPath);
                if (stat.isFile()) {
                    await fs.promises.unlink(storedPath);
                }
            } catch (e) {
                // ignore
            }
        }
    }

    private async fetchReportFileUrl(authorized: Authorized, reportId: string, projectId: string): Promise<string | undefined> {
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

    private async fetchReportFile(reportId: string, projectId: string, url: string): Promise<string | undefined> {
        try {
            let filePath = await reportPath(this.context, reportId);
            return await downloadFile(url, filePath);
        } catch (e) {
            vscode.window.showErrorMessage(failedToDownloadReport(projectId) + `: ${e}`);
            telemetry.errorReceived('#fetchReportFile exception');
            return undefined;
        }
    }
}
