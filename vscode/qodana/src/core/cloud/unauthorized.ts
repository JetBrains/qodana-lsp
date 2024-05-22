import {AuthorizationResponseData, QodanaCloudUnauthorizedApi, QodanaOauthProviderData} from "./api";
import {BackendUrls, CloudEnvironment} from "./index";
import axios, {AxiosRequestConfig} from "axios";
import * as vscode from "vscode";
import {FAILED_TO_AUTHENTICATE} from "../messages";
import telemetry from "../telemetry";

export class QodanaCloudUnauthorizedApiImpl implements QodanaCloudUnauthorizedApi {
    private version = "1";
    private environment: CloudEnvironment;

    constructor(environment: CloudEnvironment) {
        this.environment = environment;
    }

    async getOauthToken(code: string | undefined) {
        let host = await this.environment.getBackendUrlForVersion(this.version);
        return this.requestToken(
            new URL(`${host}/idea/auth/token/`).toString(),
            { 'code': code },
            /* eslint-disable @typescript-eslint/naming-convention */
            { headers: { 'User-Agent': 'qodana-lsp', 'Content-Type': 'application/json' } });
    }

    async refreshOauthToken(refreshToken: string | undefined) {
        let host = await this.environment.getBackendUrlForVersion(this.version);
        return this.requestToken(
            new URL(`${host}/idea/auth/refresh/`).toString(),
            null,
            /* eslint-disable @typescript-eslint/naming-convention */
            {
                headers: {
                    'User-Agent': 'qodana-lsp',
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + refreshToken
                }
            });
    }

    async getOauthProviderData() {
        let host = await this.environment.getBackendUrlForVersion(this.version);
        const url = new URL(`${host}/oauth/configurations`).toString();
        let config = {
            headers: { 'User-Agent': 'qodana-lsp' }
        };
        let res = await axios.get(url, config);
        if (res.data) {
            return res.data as QodanaOauthProviderData;
        }
        return undefined;
    }

    async requestToken(url: string, data?: any, config?: AxiosRequestConfig<any>): Promise<AuthorizationResponseData | undefined> {
        try {
            let res = await axios.post(url, data, config);
            if (res.data) {
                return res.data as AuthorizationResponseData;
            } else {
                return undefined;
            }
        } catch (error) {
            vscode.window.showErrorMessage(`${FAILED_TO_AUTHENTICATE} ${error}`);
            telemetry.errorReceived('#requestToken exception');
            return undefined;
        }
    }

    async getBackendUrls(frontendUrl: string): Promise<BackendUrls | undefined> {
        const url = new URL("api/versions", frontendUrl).toString();
        let config = {
            headers: { 'User-Agent': 'qodana-lsp' }
        };
        let res = await axios.get(url, config);
        if (res.data) {
            return (res.data as BackendUrls);
        }
        return undefined;
    }
}