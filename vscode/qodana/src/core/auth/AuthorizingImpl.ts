import {Authorizing, AuthState_, NotAuthorized} from "./index";
import {NotAuthorizedImpl} from "./NotAuthorizedImpl";
import * as vscode from "vscode";
import {AUTH_FAILED, FAILED_TO_AUTHENTICATE, FAILED_TO_OBTAIN_TOKEN} from "../messages";
import telemetry from "../telemetry";
import * as net from "net";
import * as http from "http";
import {qodanaCloudUnauthorizedApi, qodanaCloudUserApi} from "../cloud/api";
import {AuthorizedImpl} from "./AuthorizedImpl";
import {CloudEnvironment} from "../cloud";

export class AuthorizingImpl implements Authorizing {
    private readonly stateEmitter: vscode.EventEmitter<AuthState_>;
    private readonly context: vscode.ExtensionContext;
    private readonly initialFrontendUrl?: string;
    private readonly environment: CloudEnvironment;

    constructor(context: vscode.ExtensionContext, stateEmitter: vscode.EventEmitter<AuthState_>,
                initialFrontendUrl?: string) {
        this.stateEmitter = stateEmitter;
        this.context = context;
        this.initialFrontendUrl = initialFrontendUrl;
        this.environment = new CloudEnvironment(this.initialFrontendUrl);
    }

    async startOauth() {
        // authorize
        try {
            let code = await this.getCodeFromOAuth();
            if (!code) {
                vscode.window.showErrorMessage(AUTH_FAILED);
                telemetry.errorReceived('#handleUnauthorizedState no code');
                return;
            }

            // do a post request to get token, refresh token and expires
            let auth = await qodanaCloudUnauthorizedApi(this.environment).getOauthToken(code);
            if (!auth) {
                vscode.window.showErrorMessage(FAILED_TO_OBTAIN_TOKEN);
                telemetry.errorReceived('#handleUnauthorizedState no auth');
                let newState = new NotAuthorizedImpl(this.context, this.stateEmitter);
                this.stateEmitter.fire(newState);
                return;
            }
            let userInfo = await qodanaCloudUserApi(this.environment, async () => {
                return auth?.access;
            }).getUserInfo();
            let newState = new AuthorizedImpl(this.context, this.stateEmitter, this.environment, auth, userInfo);
            this.stateEmitter.fire(newState);
        } catch (error) {
            let newState = new NotAuthorizedImpl(this.context, this.stateEmitter);
            this.stateEmitter.fire(newState);
        }
    }

    async getCodeFromOAuth(): Promise<string | undefined> {
        const portNumber = await this.freePortNumber(); // race condition here
        const server: http.Server = http.createServer().listen(portNumber, 'localhost');
        try {
            let authUrl = (await qodanaCloudUnauthorizedApi(this.environment).getOauthProviderData())?.oauthUrl;
            if (authUrl === undefined) {
                return undefined;
            }
            return await this.makeOAuthRequest(authUrl, server, portNumber);
        } catch (error) {
            vscode.window.showErrorMessage(`${FAILED_TO_AUTHENTICATE} ${error}`);
            telemetry.errorReceived('#getCodeFromOAuth exception');
            return undefined;
        } finally {
            server.close();
        }
    }

    private constructOAuthURL(authzUrl: string, port: number, randomString: string): string {
        const url = new URL(authzUrl);

        const params = new URLSearchParams(url.search);
        params.append("state", `idea-${port}-${randomString}`);

        url.search = params.toString();

        return url.toString();
    }

    async makeOAuthRequest(authzUrl: string, server: http.Server, port: number): Promise<string> {
        return new Promise((resolve, reject) => {
            // generate random string of 32 characters
            let randomString = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            vscode.env.openExternal(vscode.Uri.parse(this.constructOAuthURL(authzUrl, port, randomString)));

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
                res.writeHead(302, {'Location': `${this.environment.frontendUrl}/ideauth`});
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

    cancelAuthorization(): NotAuthorized {
        let newState = new NotAuthorizedImpl(this.context, this.stateEmitter);
        this.stateEmitter.fire(newState);
        return newState;
    }
}