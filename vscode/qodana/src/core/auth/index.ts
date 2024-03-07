import * as vscode from "vscode";
import http = require('http');
import axios from 'axios';
import { AxiosRequestConfig } from "axios";
import * as net from 'net';
import { apiUrl, authUrl, clientId, cloudWebsite, } from "../defaults";
import { AUTH_FAILED, AUTH_NEEDED, CANCEL, FAILED_TO_AUTHENTICATE, FAILED_TO_OBTAIN_TOKEN, FAILED_TO_RENEW_TOKEN, PROCEED } from "../messages";
import telemetry from "../telemetry";

/* eslint-disable @typescript-eslint/naming-convention */

export const QODANA_TOKEN = 'qodanaToken';
export const SEC_TOKEN = 'token';
export const SEC_REFRESH_TOKEN = 'refreshToken';
export const SEC_EXPIRES = 'expires';
export const SEC_REFRESH_TOKEN_USED = 'refreshTokenUsed';

export enum AuthState {
    Unauthorized,
    TokenPresent,
    TokenExpired,
}

interface AuthorizationResponseData {
    access: string,
    refresh: string,
    expires_at: string
}

export class Auth {
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async resetTokens(): Promise<void> {
        await this.context.secrets.delete(SEC_TOKEN);
        await this.context.secrets.delete(SEC_REFRESH_TOKEN);
        await this.context.secrets.delete(SEC_EXPIRES);
        await this.context.secrets.delete(SEC_REFRESH_TOKEN_USED);
        await this.context.secrets.delete(QODANA_TOKEN);
    }

    async getTokenToCloud(): Promise<string | undefined> {
        try {
            // we need to fetch current auth state
            const authState = await this.getAuthState();
            // if we are unauthorized, we need to authorize
            if (authState === AuthState.Unauthorized) {
                return this.handleUnauthorizedState();
            } else if (authState === AuthState.TokenExpired) {
                return this.handleTokenExpiredState();
            } else if (authState === AuthState.TokenPresent) {
                // get data
                return await this.context.secrets.get(SEC_TOKEN);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`${FAILED_TO_AUTHENTICATE} ${error}`);
            telemetry.errorReceived('#getTokenToCloud exception');
            return undefined;
        }
    }

    async getAuthState(): Promise<AuthState> {
        const token = await this.context.secrets.get(SEC_TOKEN);
        const refreshToken = await this.context.secrets.get(SEC_REFRESH_TOKEN);
        const refreshTokenUsed = await this.context.secrets.get(SEC_REFRESH_TOKEN_USED);
        const expires = await this.context.secrets.get(SEC_EXPIRES);
        if (!token || !refreshToken || !expires) {
            return AuthState.Unauthorized;
        }
        let now = new Date();
        let expiresDate = new Date(expires);
        if (now > expiresDate) {
            if (refreshTokenUsed === 'true') {
                return AuthState.Unauthorized;
            }
            return AuthState.TokenExpired;
        }
        return AuthState.TokenPresent;
    }

    async handleUnauthorizedState(): Promise<string | undefined> {
        let decision = await vscode.window.showInformationMessage(AUTH_NEEDED, PROCEED, CANCEL);
        if (decision !== PROCEED) {
            return undefined;
        }

        // authorize
        let code = await this.getCodeFromOAuth();
        if (!code) {
            vscode.window.showErrorMessage(AUTH_FAILED);
            telemetry.errorReceived('#handleUnauthorizedState no code');
            return undefined;
        }

        // do a post request to get token, refresh token and expires
        let auth = await this.requestToken(
            new URL('v1/idea/auth/token/', apiUrl()).toString(), 
            { 'code': code }, 
            { headers: { 'Content-Type': 'application/json' } });
        if (!auth) {
            vscode.window.showErrorMessage(FAILED_TO_OBTAIN_TOKEN);
            telemetry.errorReceived('#handleUnauthorizedState no auth');
            return undefined;
        }
        await this.storeAuthTokens(auth);
        return auth.access;
    }

    async handleTokenExpiredState(): Promise<string | undefined> {
        let refreshToken = await this.context.secrets.get(SEC_REFRESH_TOKEN);
        let auth = await this.requestToken(
            new URL('v1/idea/auth/refresh/', apiUrl()).toString(), 
            null, 
            { headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + refreshToken } });
        if (!auth) {
            vscode.window.showErrorMessage(FAILED_TO_RENEW_TOKEN);
            telemetry.errorReceived('#handleTokenExpiredState no auth');
            return undefined;
        }
        await this.context.secrets.store(SEC_REFRESH_TOKEN_USED, 'true');
        await this.storeAuthTokens(auth);
        return auth.access;
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

    async storeAuthTokens(auth: AuthorizationResponseData) {
        await this.context.secrets.store(SEC_TOKEN, auth.access);
        await this.context.secrets.store(SEC_REFRESH_TOKEN, auth.refresh);
        await this.context.secrets.store(SEC_EXPIRES, auth.expires_at);
        await this.context.secrets.store(SEC_REFRESH_TOKEN_USED, 'false');
    }

    async getCodeFromOAuth(): Promise<String | undefined> {
        const portNumber = await this.freePortNumber(); // race condition here
        const server: http.Server = http.createServer().listen(portNumber, 'localhost');
        try {
            return await this.makeOAuthRequest(authUrl(), clientId(), `${apiUrl()}/v1/oauth/callback`, server, portNumber);
        } catch (error) {
            vscode.window.showErrorMessage(`${FAILED_TO_AUTHENTICATE} ${error}`);
            telemetry.errorReceived('#getCodeFromOAuth exception');
        } finally {
            server.close();
        }
    }

    private constructOAuthURL(authzUrl: string, clientId: string, redirectUri: string, port: number, randomString: string): string {
        const url = new URL(authzUrl);
    
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            scope: 'openid offline_access r_managed_customers',
            response_type: 'code',
            state: `idea-${port}-${randomString}`
        });
    
        url.search = params.toString();
    
        return url.toString();
    }

    async makeOAuthRequest(authzUrl: string, clientId: string, redirectUri: string, server: http.Server, port: number): Promise<string> {
        return new Promise((resolve, reject) => {
            // generate random string of 32 characters
            let randomString = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            vscode.env.openExternal(vscode.Uri.parse(this.constructOAuthURL(authzUrl, clientId, redirectUri, port, randomString)));

            server.on('request', (req: http.IncomingMessage, res: http.ServerResponse) => {
                const reqUrl = new URL(`http://${req.headers.host}${req.url}`);
                if (reqUrl.pathname === '/api/qodana/oauth/authorization_code/') {
                    const code = reqUrl.searchParams.get('code');
                    if (code) {
                        resolve(code);
                    } else {
                        telemetry.errorReceived('#makeOAuthRequest no code');
                        reject();
                    }
                }
                // redirect to the page with the message
                res.writeHead(302, { 'Location': `${cloudWebsite()}/ideauth` });
                res.end();
            });
        });
    }

    async freePortNumber(): Promise<number> {
        return new Promise((resolve, reject) => {
            const server = net.createServer();
            server.listen(0, '127.0.0.1');
            server.on('listening', function () {
                try {
                    const address = server.address();
                    if (address) {
                        const portNumber = (address as net.AddressInfo).port;
                        server.once('close', function () {
                            resolve(portNumber);
                        });
                    }
                } catch (error) {
                    telemetry.errorReceived('#freePortNumber exception');
                    reject(error);
                } finally {
                    server.close();
                }
            });
        });
    }
}