import {
    Auth,
    Authorized,
    AuthState_,
    NotAuthorized, SEC_EXPIRES, SEC_REFRESH_TOKEN, SEC_REFRESH_TOKEN_USED, SEC_TOKEN,
    TokenExpired,
    TokenPresent,
    Unauthorized
} from "./index";
import {NotAuthorizedImpl} from "./NotAuthorizedImpl";
import * as vscode from "vscode";
import {
    AuthorizationResponseData,
    qodanaCloudUnauthorizedApi,
    QodanaCloudUserApi, QodanaCloudUserInfoResponse,
} from "../cloud/api";
import {FAILED_TO_AUTHENTICATE, FAILED_TO_RENEW_TOKEN} from "../messages";
import telemetry from "../telemetry";
import {CloudEnvironment} from "../cloud";
import {QodanaCloudUserApiImpl} from "../cloud/user";
import {SERVER, USER_FULL_NAME, USER_ID, USER_NAME} from "../config";

export class AuthorizedImpl implements Authorized {
    private readonly stateEmitter: vscode.EventEmitter<AuthState_>;
    private readonly context: vscode.ExtensionContext;
    public readonly environment: CloudEnvironment;

    static async create(context: vscode.ExtensionContext,
                        stateEmitter: vscode.EventEmitter<AuthState_>,
                        environment: CloudEnvironment,
                        auth: AuthorizationResponseData,
                        userInfo?: QodanaCloudUserInfoResponse): Promise<AuthorizedImpl> {
        let authorized = new AuthorizedImpl(context, stateEmitter, environment, userInfo);
        await authorized.storeAuthTokens(auth);
        return authorized;
    }

    private constructor(context: vscode.ExtensionContext,
                        stateEmitter: vscode.EventEmitter<AuthState_>,
                        environment: CloudEnvironment,
                        readonly userInfo?: QodanaCloudUserInfoResponse) {
        this.stateEmitter = stateEmitter;
        this.context = context;
        this.environment = environment;
        this.getToken = this.getToken.bind(this);
        this.context.globalState.update(SERVER, environment.frontendUrl);
        this.context.globalState.update(USER_ID, userInfo?.id);
        this.context.globalState.update(USER_FULL_NAME, userInfo?.fullName);
        this.context.globalState.update(USER_NAME, userInfo?.username);
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
                await this.logOut();
                return undefined;
            } else if (authState instanceof TokenExpired) {
                let token = await this.handleTokenExpiredState();
                if (token === undefined) {
                    await this.logOut();
                }
                return token;
            } else if (authState instanceof TokenPresent) {
                // get data
                return authState.token;
            }
        } catch (error) {
            vscode.window.showErrorMessage(`${FAILED_TO_AUTHENTICATE} ${error}`);
            telemetry.errorReceived('#getTokenToCloud exception');
            await this.logOut();
            return undefined;
        }
    }

    async handleTokenExpiredState(): Promise<string | undefined> {
        let refreshToken = await this.context.secrets.get(SEC_REFRESH_TOKEN);
        let auth = await qodanaCloudUnauthorizedApi(this.environment).refreshOauthToken(refreshToken);
        if (!auth) {
            vscode.window.showErrorMessage(FAILED_TO_RENEW_TOKEN);
            telemetry.errorReceived('#handleTokenExpiredState no auth');
            return undefined;
        }
        await this.context.secrets.store(SEC_REFRESH_TOKEN_USED, 'true');
        await this.storeAuthTokens(auth);
        return auth.access;
    }

    async storeAuthTokens(auth: AuthorizationResponseData) {
        await this.context.secrets.store(SEC_TOKEN, auth.access);
        await this.context.secrets.store(SEC_REFRESH_TOKEN, auth.refresh);
        await this.context.secrets.store(SEC_EXPIRES, auth.expires_at);
        await this.context.secrets.store(SEC_REFRESH_TOKEN_USED, 'false');
    }

    async logOut(): Promise<NotAuthorized> {
        let newState = new NotAuthorizedImpl(this.context, this.stateEmitter);
        await this.resetTokens();
        this.stateEmitter.fire(newState);
        return newState;
    }

    async resetTokens(): Promise<void> {
        await this.context.secrets.delete(SEC_TOKEN);
        await this.context.secrets.delete(SEC_REFRESH_TOKEN);
        await this.context.secrets.delete(SEC_EXPIRES);
        await this.context.secrets.delete(SEC_REFRESH_TOKEN_USED);
        this.context.globalState.update(SERVER, undefined);
        this.context.globalState.update(USER_ID, undefined);
        this.context.globalState.update(USER_FULL_NAME, undefined);
        this.context.globalState.update(USER_NAME, undefined);
    }
}