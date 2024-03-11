import * as vscode from "vscode";
import {
    AuthorizationResponseData, MatchingProject, QodanaCloudUserApi
} from "../cloud/api";
import {NotAuthorizedImpl} from "./NotAuthorizedImpl";
import {AuthorizingImpl} from "./AuthorizingImpl";
import {AuthorizedImpl} from "./AuthorizedImpl";
import {CloudEnvironment} from "../cloud";
import {convertHttpToSsh, convertSshToHttp, getRemoteOrigin} from "../git";

/* eslint-disable @typescript-eslint/naming-convention */

export const QODANA_TOKEN = 'qodanaToken';
export const SEC_TOKEN = 'token';
export const SEC_REFRESH_TOKEN = 'refreshToken';
export const SEC_EXPIRES = 'expires';
export const SEC_REFRESH_TOKEN_USED = 'refreshTokenUsed';

export interface AuthState {
}


export class Unauthorized implements AuthState {

}

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
    authorize(frontendUrl?: string): Authorizing
}

export interface Authorizing extends AuthState_ {
    cancelAuthorization(): NotAuthorized
}

export interface Authorized extends AuthState_ {
    getToken(): Promise<string | undefined>
    logOut(): NotAuthorized
    qodanaCloudUserApi<T>(request: (apiObj: QodanaCloudUserApi) => Promise<T>): Promise<T>
}

export class Auth {
    private context: vscode.ExtensionContext;

    stateEmitter: vscode.EventEmitter<AuthState_> = new vscode.EventEmitter();

    private lastState: AuthState_ | null = null;

    static async create(context: vscode.ExtensionContext): Promise<Auth> {
        let instance = new Auth(context);
        let savedServer = context.globalState.get('qodanaServer') as string;
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
            newState = new AuthorizedImpl(context, instance.stateEmitter, environment, auth);
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
                vscode.commands.executeCommand("setContext", "qodana.authorizing", false);
                vscode.commands.executeCommand("setContext", "qodana.signed-in", false);
            } else if (state instanceof AuthorizingImpl) {
                vscode.commands.executeCommand("setContext", "qodana.authorizing", true);
                vscode.commands.executeCommand("setContext", "qodana.signed-in", false);
                state.startOauth();
            } else if (state instanceof AuthorizedImpl) {
                vscode.commands.executeCommand("setContext", "qodana.authorizing", false);
                vscode.commands.executeCommand("setContext", "qodana.signed-in", true);
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
            let promises =
                [withoutSuffix, `${withoutSuffix}.git`, sshRemoteWithoutSuffix, `ssh://${sshRemoteWithoutSuffix}`,
                 `${sshRemoteWithoutSuffix}.git`, `ssh://${sshRemoteWithoutSuffix}.git`].flatMap( async(repoUrl) => {
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


    async handleUnauthorizedState(frontendUrl?: string): Promise<string | undefined> {
        if (this.lastState instanceof NotAuthorizedImpl) {
            this.lastState.authorize(frontendUrl);
        }
        return undefined;
    }

    logOut() {
        if (this.lastState instanceof AuthorizedImpl) {
            this.lastState.logOut();
        }
    }

    cancelAuthorization() {
        if (this.lastState instanceof AuthorizingImpl) {
            this.lastState.cancelAuthorization();
        }
    }
}