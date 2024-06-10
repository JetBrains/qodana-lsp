import {AuthorizationResponseData, QodanaCloudUnauthorizedApi, QodanaOauthProviderData} from './api';
import {BackendUrls, CloudEnvironment, getHeaders} from './index';
import axios, {AxiosRequestConfig} from 'axios';
import * as vscode from 'vscode';
import {FAILED_TO_AUTHENTICATE} from '../messages';
import telemetry from '../telemetry';

export class QodanaCloudUnauthorizedApiImpl implements QodanaCloudUnauthorizedApi {
    private version = '1';
    private environment: CloudEnvironment;

    constructor(environment: CloudEnvironment) {
        this.environment = environment;
    }

    async getOauthToken(code: string | undefined) {
        let host = await this.environment.getBackendUrlForVersion(this.version);
        return this.requestToken(
            new URL(`${host}/idea/auth/token/`).toString(),
            { 'code': code },
            { headers: getHeaders() });
    }

    async refreshOauthToken(refreshToken: string | undefined) {
        let host = await this.environment.getBackendUrlForVersion(this.version);
        return this.requestToken(
            new URL(`${host}/idea/auth/refresh/`).toString(),
            null,
            { headers: getHeaders(refreshToken) }
        );
    }

    async getOauthProviderData() {
        let host = await this.environment.getBackendUrlForVersion(this.version);
        const url = new URL(`${host}/oauth/configurations`).toString();
        let config = {
            headers: getHeaders()
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
        const url = new URL('api/versions', frontendUrl).toString();
        let config = {
            headers: getHeaders()
        };
        let res = await axios.get(url, config);
        if (res.data) {
            return (res.data as BackendUrls);
        }
        return undefined;
    }
}