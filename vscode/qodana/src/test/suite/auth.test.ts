import * as assert from 'assert';

import * as vscode from 'vscode';
import * as sinon from 'sinon';
import {
    Auth,
    AuthState, AuthState_,
    SEC_EXPIRES,
    SEC_REFRESH_TOKEN,
    SEC_REFRESH_TOKEN_USED,
    SEC_TOKEN, TokenExpired, TokenPresent,
    Unauthorized
} from '../../core/auth';
import { FAILED_TO_AUTHENTICATE, PROCEED } from '../../core/messages';
import axios from 'axios';
import {AuthorizedImpl} from "../../core/auth/AuthorizedImpl";
import {CloudEnvironment} from "../../core/cloud";
import {NotAuthorizedImpl} from "../../core/auth/NotAuthorizedImpl";
import {AuthorizingImpl} from "../../core/auth/AuthorizingImpl";

/* eslint-disable @typescript-eslint/naming-convention */

describe('Authentication Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let auth: Auth;
    let context: vscode.ExtensionContext;
    let secretStorage: vscode.SecretStorage;
    let map = new Map<string, string>();

    beforeEach(async () => {
        sandbox = sinon.createSandbox();
        secretStorage = {
            get: sandbox.stub().callsFake(async (key) => { return map.get(key); }),
            store: sandbox.stub().callsFake(async (key, value) => { map.set(key, value); }),
            delete: sandbox.stub().callsFake(async (key) => { map.delete(key); }),
            keys: sandbox.stub().callsFake(async () => { return Array.from(map.keys()); }),
            onDidChange: sandbox.stub(),
        } as vscode.SecretStorage;

        context = {
            secrets: secretStorage,
            globalState: {}
        } as vscode.ExtensionContext;

        sandbox.stub(context, 'globalState').value({
            get: sandbox.stub().callsFake((key: string) => {
                return map.get(key);
            }),
            update: sandbox.stub().callsFake((key: string, value: string) => {
                map.set(key, value);
            }),
        } as any);

        auth = await Auth.create(context);
    });

    afterEach(() => {
        sandbox.restore();
        map.clear();
    });

    describe('#getAuthState()', function () {
        it('should return Unauthorized if no token, refresh token or expires exist', async function () {
            const result = await Auth.getAuthState(context);
            assert(result instanceof Unauthorized);
        });

        it('should return TokenExpired if the token expiration time has passed and refresh token has not been used', async function () {
            const pastDate = new Date();
            pastDate.setFullYear(pastDate.getFullYear() - 1);
            map.set(SEC_EXPIRES, pastDate.toString());
            map.set(SEC_REFRESH_TOKEN_USED, 'false');
            map.set(SEC_TOKEN, 'any');
            map.set(SEC_REFRESH_TOKEN, 'any');
            const result = await Auth.getAuthState(context);
            assert(result instanceof TokenExpired);
        });

        it('should return TokenPresent if all conditions are valid and refresh token has not been used', async function () {
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1); // Set expires to be 1 year from now
            map.set(SEC_EXPIRES, futureDate.toString());
            map.set(SEC_REFRESH_TOKEN_USED, 'false');
            map.set(SEC_TOKEN, 'any');
            map.set(SEC_REFRESH_TOKEN, 'any');
            const result = await Auth.getAuthState(context);
            assert(result instanceof TokenPresent);
        });

        it('should return TokenPresent when refreshTokenUsed is true, but expiration time has not passed', async function () {
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);
            map.set(SEC_EXPIRES, futureDate.toString());
            map.set(SEC_REFRESH_TOKEN_USED, 'true');
            map.set(SEC_TOKEN, 'any');
            map.set(SEC_REFRESH_TOKEN, 'any');
            const result = await Auth.getAuthState(context);
            assert(result instanceof TokenPresent);
        });
    });

    describe('#resetTokens()', function () {
        it('should call delete method for each token', async function () {
            let authorized = new AuthorizedImpl(context, new vscode.EventEmitter, new CloudEnvironment(), {
                access: 'access',
                refresh: 'refresh',
                expires_at: 'expires'
            });
            await authorized.resetTokens();
            let stub = context.secrets.delete as sinon.SinonStub;
            assert.strictEqual(stub.callCount, 4);
            assert.strictEqual(stub.calledWith(SEC_TOKEN), true);
            assert.strictEqual(stub.calledWith(SEC_REFRESH_TOKEN), true);
            assert.strictEqual(stub.calledWith(SEC_EXPIRES), true);
            assert.strictEqual(stub.calledWith(SEC_REFRESH_TOKEN_USED), true);
        });
    });

    describe('#storeAuthTokens()', function () {
        it('should store the proper secrets', async function () {
            const tokenData = {
                access: 'access',
                refresh: 'refresh',
                expires_at: 'expires_at'
            };

            let authorized = new AuthorizedImpl(context, new vscode.EventEmitter, new CloudEnvironment(), tokenData);
            await authorized.storeAuthTokens(tokenData);
            assert.strictEqual(map.get(SEC_TOKEN), 'access');
            assert.strictEqual(map.get(SEC_REFRESH_TOKEN), 'refresh');
            assert.strictEqual(map.get(SEC_EXPIRES), 'expires_at');
            assert.strictEqual(map.get(SEC_REFRESH_TOKEN_USED), 'false');
        });
    });

    describe('#NotAuthorized', function () {
        it('authorize fires stateEmitter', async function () {
            let emitter = new vscode.EventEmitter<AuthState>();
            sandbox.stub(emitter, 'fire').value(
                sandbox.stub().callsFake(async () => { return; })
            );
            let notAuthorized = new NotAuthorizedImpl(context, emitter);

            const authorizing = notAuthorized.authorize();
            let stub = emitter.fire as sinon.SinonStub;
            assert.strictEqual(stub.callCount, 1);
        });
    });

    describe('#Authorizing',  function () {
        it('authorizing success', async function () {
            let emitter = new vscode.EventEmitter<AuthState_>();
            let val: any = undefined;
            sandbox.stub(emitter, 'fire').value(
                sandbox.stub().callsFake(async (state: AuthState_) => { val = state;})
            );
            setupAxiosPostRequest();

            let authorizing = new AuthorizingImpl(context, emitter);

            sandbox.stub(authorizing, 'getCodeFromOAuth').resolves('externalToken');

            await authorizing.startOauth();
            assert(val instanceof AuthorizedImpl);
        });

        it('authorizing failure', async function () {
            let emitter = new vscode.EventEmitter<AuthState_>();
            let val: any = undefined;
            sandbox.stub(emitter, 'fire').value(
                sandbox.stub().callsFake(async (state: AuthState_) => { val = state;})
            );
            sandbox.stub(axios, 'post').callsFake(async (url, data) => {
                assert.strictEqual((data as any).code, 'externalToken');
                return undefined;
            });

            let authorizing = new AuthorizingImpl(context, emitter);

            sandbox.stub(authorizing, 'getCodeFromOAuth').resolves('externalToken');

            await authorizing.startOauth();
            assert(val instanceof NotAuthorizedImpl);
        });


        it('should handle errors properly', async function () {
            let stub = sandbox.stub(vscode.window, 'showErrorMessage');
            let authorizing = new AuthorizingImpl(context, new vscode.EventEmitter);
            setupAxiosPostRequest();
            sandbox.stub(axios, 'get').rejects(new Error('Test error'));

            const token = await authorizing.getCodeFromOAuth();

            assert.strictEqual(token, undefined);
            assert.strictEqual(stub.calledWith(`${FAILED_TO_AUTHENTICATE} Error: Test error`), true);
        });
    });

    describe('#Authorized', function () {
        it('Unauthorized leading to log out', async function () {
            const tokenData = {
               access: 'access',
               refresh: 'refresh',
               expires_at: 'expires_at'
            };
            let emitter = new vscode.EventEmitter<AuthState>();
            sandbox.stub(emitter, 'fire').value(
               sandbox.stub().callsFake(async (key: string) => { return 'data'; })
            );
            let authorized = new AuthorizedImpl(context, emitter, new CloudEnvironment(), tokenData);

            sandbox.stub(Auth, 'getAuthState').resolves(new Unauthorized());

            const token = await authorized.getToken();
            let stub = emitter.fire as sinon.SinonStub;
            assert.strictEqual(stub.callCount, 1);
            assert.strictEqual(token, undefined);
        });

        it('TokenExpired refreshes then returns token', async function () {
            const tokenData = {
                access: 'access',
                refresh: 'refresh',
                expires_at: 'expires_at'
            };
            let authorized = new AuthorizedImpl(context, new vscode.EventEmitter, new CloudEnvironment(), tokenData);

            sandbox.stub(Auth, 'getAuthState').resolves(new TokenExpired('old_token', 'refresh', 'access'));
            setupAxiosPostRequest();

            const token = await authorized.getToken();
            assert.strictEqual(token, 'freshToken');
            assert.strictEqual(map.get(SEC_TOKEN), 'freshToken');
            assert.strictEqual(map.get(SEC_REFRESH_TOKEN), 'freshRefreshToken');
            assert.strictEqual(map.get(SEC_EXPIRES), '2021-01-01T00:00:00Z');
        });


        it('TokenExpired refresh failed then log out', async function () {
            const tokenData = {
                access: 'access',
                refresh: 'refresh',
                expires_at: 'expires_at'
            };
            let emitter = new vscode.EventEmitter<AuthState>();
            sandbox.stub(emitter, 'fire').value(
                sandbox.stub().callsFake(async (key: string) => { return; })
            );
            let authorized = new AuthorizedImpl(context, emitter, new CloudEnvironment(), tokenData);

            sandbox.stub(Auth, 'getAuthState').resolves(new TokenExpired('old_token', 'refresh', 'access'));
            sandbox.stub(authorized, 'handleTokenExpiredState').resolves(undefined);

            const token = await authorized.getToken();
            let stub = emitter.fire as sinon.SinonStub;
            assert.strictEqual(token, undefined);
            assert.strictEqual(stub.callCount, 1);
        });

        it('TokenPresent returns token', async function () {
            const tokenData = {
                access: 'access',
                refresh: 'refresh',
                expires_at: 'expires_at'
            };
            let authorized = new AuthorizedImpl(context, new vscode.EventEmitter, new CloudEnvironment(), tokenData);

            sandbox.stub(Auth, 'getAuthState').resolves(new TokenPresent('old_token', 'refresh', 'access'));
            sandbox.stub(authorized, 'handleTokenExpiredState').resolves(undefined);

            const token = await authorized.getToken();
            assert.strictEqual(token, 'old_token');
        });
    });

    describe('#getTokenToCloud()', function () {
        it('should return token when AuthState is TokenPresent', async function () {
            const tokenData = {
                access: 'access',
                refresh: 'refresh',
                expires_at: 'expires_at'
            };

            let authorized = new AuthorizedImpl(context, new vscode.EventEmitter, new CloudEnvironment(), tokenData);

            sandbox.stub(Auth, 'getAuthState').resolves(new TokenPresent('token', 'refresh', 'expires'));
            map.set(SEC_TOKEN, 'token');

            const token = await authorized.getToken();
            assert.strictEqual(token, 'token');
        });
    });

    function setupAxiosPostRequest(withCheckCode: boolean = false) {
        let oldPost = axios.post;
        sandbox.stub(axios, 'post').callsFake(async (url, data) => {
            if (withCheckCode) {
                assert.strictEqual((data as any).code, 'externalToken');
            }
            return {
                data: {
                    'access': 'freshToken',
                    'refresh': 'freshRefreshToken',
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'expires_at': '2021-01-01T00:00:00Z',
                }
            };
        });
        sandbox.stub(vscode.window, 'showInformationMessage').callsFake(() => Promise.resolve(PROCEED as any));
        sandbox.stub(vscode.env, 'openExternal').callsFake(async (url) => {
            let state = url.query.split('&').find((item) => item.startsWith('state='));
            if (!state) {
                assert.fail('state is not present');
            }
            let port = state.split('-')[1];
            if (!port) {
                assert.fail('port is not present');
            }
            await oldPost('http://localhost:' + port + '/api/qodana/oauth/authorization_code/?code=externalToken', {});
            return true;
        });
    }
});
