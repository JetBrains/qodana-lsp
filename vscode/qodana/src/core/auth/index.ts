import * as vscode from "vscode";
import {
    AuthorizationResponseData, MatchingProject, QodanaCloudUserApi, QodanaCloudUserInfoResponse
} from "../cloud/api";
import {NotAuthorizedImpl} from "./NotAuthorizedImpl";
import {AuthorizingImpl} from "./AuthorizingImpl";
import {AuthorizedImpl} from "./AuthorizedImpl";
import {CloudEnvironment} from "../cloud";
import {convertHttpToSsh, convertSshToHttp, getRemoteOrigin} from "../git";
import {SERVER, STATE_AUTHORIZING, STATE_SIGNED_IN, USER_FULL_NAME, USER_ID, USER_NAME} from "../config";
import {extensionInstance} from "../extension";

/* eslint-disable @typescript-eslint/naming-convention */

export const QODANA_TOKEN = 'qodanaToken';
export const SEC_TOKEN = 'token';
export const SEC_REFRESH_TOKEN = 'refreshToken';
export const SEC_EXPIRES = 'expires';
export const SEC_REFRESH_TOKEN_USED = 'refreshTokenUsed';

export interface AuthState {}

export class Unauthorized implements AuthState {}

//todo refactor
export interface InternalAuthorized extends AuthState {
    token: string;
    refreshToken: string;
    expires: string;
}

export class TokenPresent implements InternalAuthorized {
    token: string;
    refreshToken: string;
    expires: string;
    constructor(token: string, refreshToken: string, expires: string) {
        this.token = token;
        this.refreshToken = refreshToken;
        this.expires = expires;
    }
}
export class TokenExpired implements InternalAuthorized {
    token: string;
    refreshToken: string;
    expires: string;
    constructor(token: string, refreshToken: string, expires: string) {
        this.token = token;
        this.refreshToken = refreshToken;
        this.expires = expires;
    }
}


export interface AuthState_ {}

export interface NotAuthorized extends AuthState_ {
    authorize(frontendUrl?: string): Promise<NotAuthorized | Authorized>
}

export interface Authorizing extends AuthState_ {
    cancelAuthorization(): NotAuthorized
}

export interface Authorized extends AuthState_ {
    userInfo?: QodanaCloudUserInfoResponse

    environment: CloudEnvironment;

    getToken(): Promise<string | undefined>

    logOut(): Promise<NotAuthorized>

    qodanaCloudUserApi<T>(request: (apiObj: QodanaCloudUserApi) => Promise<T>): Promise<T>
}

export class Auth {
    private context: vscode.ExtensionContext;

    stateEmitter: vscode.EventEmitter<AuthState_> = new vscode.EventEmitter();

    private lastState: AuthState_ | null = null;

    static async create(context: vscode.ExtensionContext): Promise<Auth> {
        let instance = new Auth(context);
        let savedServer = context.globalState.get(SERVER) as string;
        let authState = await Auth.getAuthState(context);
        let newState: AuthState_;
        if (authState instanceof Unauthorized) {
            newState = new NotAuthorizedImpl(context, instance.stateEmitter);
        } else {
            let environment = new CloudEnvironment(savedServer);
            let state = authState as InternalAuthorized;
            let auth: AuthorizationResponseData = {
                access: state.token, expires_at: state.expires, refresh: state.refreshToken
            };
            let id = context.globalState.get(USER_ID) as string;
            let fullName = context.globalState.get(USER_FULL_NAME) as string;
            let userName = context.globalState.get(USER_NAME) as string;
            let userInfo = {
                id: id,
                fullName: fullName,
                username: userName,
            };
            newState = await AuthorizedImpl.create(context, instance.stateEmitter, environment, auth, userInfo);
        }
        instance.stateEmitter.fire(newState);
        return instance;
    }

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.startSubscriptions();
    }

    static async getAuthState(context: vscode.ExtensionContext): Promise<AuthState> {
        const token = await context.secrets.get(SEC_TOKEN);
        const refreshToken = await context.secrets.get(SEC_REFRESH_TOKEN);
        const refreshTokenUsed = await context.secrets.get(SEC_REFRESH_TOKEN_USED);
        const expires = await context.secrets.get(SEC_EXPIRES);
        if (!token || !refreshToken || !expires) {
            return new Unauthorized;
        }
        let now = new Date();
        let expiresDate = new Date(expires);
        if (now > expiresDate) {
            if (refreshTokenUsed === 'true') {
                return new Unauthorized;
            }
            return new TokenExpired(token, refreshToken, expires);
        }
        return new TokenPresent(token, refreshToken, expires);
    }

    startSubscriptions() {
        this.stateEmitter.event(state => {
            this.lastState = state;
            if (state instanceof NotAuthorizedImpl) {
                vscode.commands.executeCommand('setContext', STATE_AUTHORIZING, false);
                vscode.commands.executeCommand("setContext", STATE_SIGNED_IN, false);
            } else if (state instanceof AuthorizingImpl) {
                vscode.commands.executeCommand("setContext", STATE_AUTHORIZING, true);
                vscode.commands.executeCommand("setContext", STATE_SIGNED_IN, false);
            } else if (state instanceof AuthorizedImpl) {
                vscode.commands.executeCommand("setContext", STATE_AUTHORIZING, false);
                vscode.commands.executeCommand("setContext", STATE_SIGNED_IN, true);
                extensionInstance.linkService?.getProjectProperties(undefined, false);
            }
        });
    }

    async resetTokens(): Promise<void> {
        if (this.lastState instanceof AuthorizedImpl) {
            await this.lastState.resetTokens();
        }
    }

    async getProjects(): Promise<MatchingProject[] | undefined> {
        let remote = getRemoteOrigin();
        if (!remote) {
            return undefined;
        }
        let httpRemote = convertSshToHttp(remote);
        let authorized = this.lastState as AuthorizedImpl;
        if (authorized) {
            let withoutSuffix = httpRemote.replace(/\.git$/, '');
            let sshRemoteWithoutSuffix = convertHttpToSsh(httpRemote);
            const createUrls = (url: string) => [url, `ssh://${url}`, `${url}.git`, `ssh://${url}.git`];
            let promises =
                [withoutSuffix, `${withoutSuffix}.git`, ...createUrls(sshRemoteWithoutSuffix[0]),
                    ...createUrls(sshRemoteWithoutSuffix[1])].flatMap( async(repoUrl) => {
                let response = await authorized.qodanaCloudUserApi((api) => {
                    return api.getProjectsByOriginUrl(repoUrl);
                });
                return response ? response.matchingProjects : [];
            });
            return Promise.all(promises).then((projects) => projects.flat());
        }
        return undefined;
    }

    getAuthorized(): Authorized | undefined {
        if (this.lastState instanceof AuthorizedImpl) {
            return this.lastState;
        }
        return undefined;
    }


    async logIn(frontendUrl?: string): Promise<AuthState_ | null> {
        let lastState = this.lastState;
        return lastState instanceof NotAuthorizedImpl ? await lastState.authorize(normalizeUrl(frontendUrl)) : lastState;
    }

    async logOut() {
        if (this.lastState instanceof AuthorizedImpl) {
            await this.lastState.logOut();
        }
    }

    cancelAuthorization() {
        if (this.lastState instanceof AuthorizingImpl) {
            this.lastState.cancelAuthorization();
        }
    }
}

export function normalizeUrl(serverName?: string): string | undefined {
    if (!serverName) {
        return serverName;
    }
    let result: string;
    if (serverName.startsWith("https://") || serverName.startsWith("http://")) {
        result = serverName;
    } else {
        result = `https://${serverName}`;
    }

    return result.endsWith('/') ? result.slice(0, -1) : result;
}