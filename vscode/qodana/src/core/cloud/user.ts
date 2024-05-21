import {CloudEnvironment} from "./index";
import {isValidString} from "../defaults";
import telemetry from "../telemetry";
import * as vscode from "vscode";
import {failedToObtainData, failedToObtainReportId, noReportsFound, projectIdIsNotValid} from "../messages";
import axios from "axios";
import {
    CloudProjectResponse,
    CloudProjectsByOriginUrlResponse,
    Files, PaginatedResponse,
    QodanaCloudFileResponse, QodanaCloudReportResponse,
    QodanaCloudUserApi, QodanaCloudUserInfoResponse
} from "./api";

export class QodanaCloudUserApiImpl implements QodanaCloudUserApi {
    private version = "1";
    private environment: CloudEnvironment;
    private readonly tokenRetriever: () => Promise<string | undefined>;

    constructor(environment: CloudEnvironment, tokenRetriever: () => Promise<string| undefined>) {
        this.environment = environment;
        this.tokenRetriever = tokenRetriever;
    }

    async getProjectsByOriginUrl(originUrl: string) {
        // const url = new URL(, await this.environment.getBackendUrlForVersion(this.version)).toString();
        return this.doRequest<CloudProjectsByOriginUrlResponse>(
            `projects/search?originUrl=${originUrl}`,
            () => "");
    }

    async getProjectProperties(projectId: string, withError: boolean = true): Promise<CloudProjectResponse | undefined> {
        return this.doRequest(`projects/${projectId}`, () => {
            if (!withError) {
                return;
            }
            vscode.window.showErrorMessage(failedToObtainData(projectId));
            telemetry.errorReceived('#getProjectProperties no data');
        });
    }

    async getReport(reportId: string, projectId: string): Promise<Files<QodanaCloudFileResponse> | undefined> {
        if (!isValidString(projectId)) {
            telemetry.errorReceived('#fetchReportFileUrl invalid project id');
            vscode.window.showErrorMessage(projectIdIsNotValid(projectId));
            return undefined;
        }
        return this.doRequest(
            `reports/${reportId}/files?${new URLSearchParams({ paths: 'qodana.sarif.json' })}`,
            () => {
                vscode.window.showErrorMessage(failedToObtainReportId(reportId, projectId));
                telemetry.errorReceived('#fetchReportFileUrl no report id');
            }
        );
    }

    async getReportId(projectId: string): Promise<string | undefined> {
        if (!isValidString(projectId)) {
            telemetry.errorReceived('#getReportId invalid project id');
            vscode.window.showErrorMessage(projectIdIsNotValid(projectId));
            return undefined;
        }
        let token = await this.tokenRetriever();
        // get report id from the server
        let pagination = {
            offset: 0,
            limit: 1,
            states: ''
        };
        pagination['states'] = 'UPLOADED,PROCESSED,PINNED';
        let host = await this.environment.getBackendUrlForVersion(this.version);
        const config = {
            url: (new URL(`${host}/projects/${projectId}/timeline`)).toString(),
            method: 'get',
            headers: {
                /* eslint-disable @typescript-eslint/naming-convention */
                'Content-Type': 'application/json',
                /* eslint-disable @typescript-eslint/naming-convention */
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

    async getUserInfo(): Promise<QodanaCloudUserInfoResponse | undefined> {
        return this.doRequest('users/me', () => {
            telemetry.errorReceived('#getUserInfo no data');
        });
    }

    private async doRequest<T>(url: string, errorHandler: () => void): Promise<T | undefined> {
        let token = await this.tokenRetriever();
        let host = await this.environment.getBackendUrlForVersion(this.version);
        let finalUrl = (new URL(`${host}/${url}`)).toString();
        const config = {
            url: finalUrl,
            method: 'get',
            headers: {
                /* eslint-disable @typescript-eslint/naming-convention */
                'Content-Type': 'application/json',
                /* eslint-disable @typescript-eslint/naming-convention */
                'Authorization': 'Bearer ' + token
            }
        };
        let res;
        try {
            res = await axios(config);
        } catch (e) {
            res = undefined;
        }
        if (!res?.data) {
            errorHandler();
            return undefined;
        }
        return res?.data as T;
    }
}