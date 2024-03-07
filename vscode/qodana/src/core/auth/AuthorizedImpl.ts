import {
    Auth,
    Authorized,
    AuthState_,
    NotAuthorized,
    TokenExpired,
    TokenPresent,
    Unauthorized
} from "./index";
import {NotAuthorizedImpl} from "./NotAuthorizedImpl";
import * as vscode from "vscode";
import {
    AuthorizationResponseData,
    qodanaCloudUnauthorizedApi,
    QodanaCloudUserApi,
} from "../cloud/api";
import {FAILED_TO_AUTHENTICATE, FAILED_TO_RENEW_TOKEN} from "../messages";
import telemetry from "../telemetry";
import {CloudEnvironment} from "../cloud";
import {QodanaCloudUserApiImpl} from "../cloud/user";

export class AuthorizedImpl implements Authorized {
    private readonly stateEmitter: vscode.EventEmitter<AuthState_>;
    private readonly context: vscode.ExtensionContext;
    private readonly environment: CloudEnvironment;

    constructor(context: vscode.ExtensionContext,
                stateEmitter: vscode.EventEmitter<AuthState_>,
                environment: CloudEnvironment,
                auth: AuthorizationResponseData) {
        this.stateEmitter = stateEmitter;
        this.context = context;
        this.environment = environment;
        this.getToken = this.getToken.bind(this);
        this.storeAuthTokens(auth);
    }

    async qodanaCloudUserApi<T>(request: (api: QodanaCloudUserApi) => Promise<T>): Promise<T> {
        const api = new QodanaCloudUserApiImpl(this.environment, this.getToken);
        return await request(api);
    }

    async getToken(): Promise<string | undefined> {
        try {
            // we need to fetch current auth state
            const authState = await Auth.getAuthState(this.context);
            // if we are unauthorized, we need to authorize
            if (authState instanceof Unauthorized) {
                this.logOut();
                return undefined;
            } else if (authState instanceof TokenExpired) {
                let token = this.handleTokenExpiredState();
                if (token === undefined) {
                    this.logOut();
                }
                return token;
            } else if (authState instanceof TokenPresent) {
                // get data
                return authState.token;
            }
        } catch (error) {
            vscode.window.showErrorMessage(`${FAILED_TO_AUTHENTICATE} ${error}`);
            telemetry.errorReceived('#getTokenToCloud exception');
            this.logOut();
            return undefined;
        }
    }


    async handleTokenExpiredState(): Promise<string | undefined> {
        let refreshToken = await this.context.secrets.get('refreshToken');
        let auth = await qodanaCloudUnauthorizedApi(this.environment).refreshOauthToken(refreshToken);
        if (!auth) {
            vscode.window.showErrorMessage(FAILED_TO_RENEW_TOKEN);
            telemetry.errorReceived('#handleTokenExpiredState no auth');
            return undefined;
        }
        await this.context.secrets.store('refreshTokenUsed', 'true');
        await this.storeAuthTokens(auth);
        return auth.access;
    }

    async storeAuthTokens(auth: AuthorizationResponseData) {
        await this.context.secrets.store('token', auth.access);
        await this.context.secrets.store('refreshToken', auth.refresh);
        await this.context.secrets.store('expires', auth.expires_at);
        await this.context.secrets.store('refreshTokenUsed', 'false');
    }

    logOut(): NotAuthorized {
        let newState = new NotAuthorizedImpl(this.context, this.stateEmitter);
        this.resetTokens();
        this.stateEmitter.fire(newState);
        return newState;
    }

    async resetTokens(): Promise<void> {
        await this.context.secrets.delete('token');
        await this.context.secrets.delete('refreshToken');
        await this.context.secrets.delete('expires');
        await this.context.secrets.delete('refreshTokenUsed');
        this.context.globalState.update('qodanaServer', undefined);
    }
}