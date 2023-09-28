import * as assert from 'assert';

import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { Auth, AuthState } from '../../core/auth';
import { FAILED_TO_AUTHENTICATE, PROCEED } from '../../core/messages';
import axios from 'axios';

/* eslint-disable @typescript-eslint/naming-convention */

describe('Authentification Test Suite', () => {
    var sandbox: sinon.SinonSandbox;
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
            secrets: secretStorage
        } as vscode.ExtensionContext;

        auth = new Auth(context);
    });

    afterEach(() => {
        sandbox.restore();
        map.clear();
    });

    describe('#getAuthState()', function () {
        it('should return Unauthorized if no token, refresh token or expires exist', async function () {
            const result = await auth.getAuthState();
            assert.strictEqual(result, AuthState.Unauthorized);
        });

        it('should return TokenExpired if the token expiration time has passed and refresh token has not been used', async function () {
            const pastDate = new Date();
            pastDate.setFullYear(pastDate.getFullYear() - 1);
            map.set('expires', pastDate.toString());
            map.set('refreshTokenUsed', 'false');
            map.set('token', 'any');
            map.set('refreshToken', 'any');
            const result = await auth.getAuthState();
            assert.strictEqual(result, AuthState.TokenExpired);
        });

        it('should return TokenPresent if all conditions are valid and refresh token has not been used', async function () {
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1); // Set expires to be 1 year from now
            map.set('expires', futureDate.toString());
            map.set('refreshTokenUsed', 'false');
            map.set('token', 'any');
            map.set('refreshToken', 'any');
            const result = await auth.getAuthState();
            assert.strictEqual(result, AuthState.TokenPresent);
        });

        it('should return TokenPresent when refreshTokenUsed is true, but expiration time has not passed', async function () {
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);
            map.set('expires', futureDate.toString());
            map.set('refreshTokenUsed', 'true');
            map.set('token', 'any');
            map.set('refreshToken', 'any');
            const result = await auth.getAuthState();
            assert.strictEqual(result, AuthState.TokenPresent);
        });
    });

    describe('#resetTokens()', function () {
        it('should call delete method for each token', async function () {
            await auth.resetTokens();
            let stub = context.secrets.delete as sinon.SinonStub;
            assert.strictEqual(stub.callCount, 4);
            assert.strictEqual(stub.calledWith('token'), true);
            assert.strictEqual(stub.calledWith('refreshToken'), true);
            assert.strictEqual(stub.calledWith('expires'), true);
            assert.strictEqual(stub.calledWith('refreshTokenUsed'), true);
        });
    });

    describe('#storeAuthTokens()', function () {
        it('should store the proper secrets', async function () {
            const tokenData = {
                access: 'access',
                refresh: 'refresh',
                expires_at: 'expires_at'
            };

            await auth.storeAuthTokens(tokenData);
            assert.strictEqual(map.get('token'), 'access');
            assert.strictEqual(map.get('refreshToken'), 'refresh');
            assert.strictEqual(map.get('expires'), 'expires_at');
            assert.strictEqual(map.get('refreshTokenUsed'), 'false');
        });
    });

    describe('#getTokenToCloud()', function () {
        it('should return token when AuthState is TokenPresent', async function () {
            sandbox.stub(auth, 'getAuthState').resolves(AuthState.TokenPresent);
            map.set('token', 'token');

            const token = await auth.getTokenToCloud();
            assert.strictEqual(token, 'token');
        });

        it('should return handleUnauthorizedState if AuthState is Unauthorized', async function () {
            sandbox.stub(auth, 'getAuthState').resolves(AuthState.Unauthorized);
            sandbox.stub(auth, 'handleUnauthorizedState').resolves('access_token');
            const token = await auth.getTokenToCloud();
            assert.strictEqual(token, 'access_token');
            assert.strictEqual((auth.handleUnauthorizedState as sinon.SinonStub).calledOnce, true);
        });

        it('should return handleTokenExpiredState if AuthState is TokenExpired', async function () {
            sandbox.stub(auth, 'getAuthState').resolves(AuthState.TokenExpired);
            sandbox.stub(auth, 'handleTokenExpiredState').resolves('access_token');
            const token = await auth.getTokenToCloud();
            assert.strictEqual(token, 'access_token');
            assert.strictEqual((auth.handleTokenExpiredState as sinon.SinonStub).calledOnce, true);
        });

        it('should handle errors properly', async function () {
            sandbox.stub(auth, 'getAuthState').rejects(new Error('Test error'));
            let stub = sandbox.stub(vscode.window, 'showErrorMessage');
            const token = await auth.getTokenToCloud();

            assert.strictEqual(token, undefined);
            assert.strictEqual(stub.calledWith(`${FAILED_TO_AUTHENTICATE} Error: Test error`), true);
        });


        it('should request new token if token is absent (model calls)', async () => {
            let oldPost = axios.post;
            sandbox.stub(axios, 'post').callsFake(async (url, data) => {
                assert.strictEqual((data as any).code, 'externalToken');
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
            let token = await auth.getTokenToCloud();
            assert.strictEqual(token, 'freshToken');
            assert.strictEqual(map.get('token'), 'freshToken');
            assert.strictEqual(map.get('refreshToken'), 'freshRefreshToken');
            assert.strictEqual(map.get('expires'), '2021-01-01T00:00:00Z');
        });
    });

    async function getContext() {
        let ext = vscode.extensions.getExtension('jetbrains.qodana-code');
        if (!ext) {
            assert.fail('Extension is not present');
        }
        let ctx = (await ext.activate()) as vscode.ExtensionContext;
        if (!ctx) {
            assert.fail('Context is not present');
        }
        return ctx;
    }
});