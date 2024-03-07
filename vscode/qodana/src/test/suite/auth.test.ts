import * as assert from 'assert';

import * as vscode from 'vscode';
import * as sinon from 'sinon';
import {Auth, AuthState, SEC_EXPIRES, SEC_REFRESH_TOKEN, SEC_REFRESH_TOKEN_USED, SEC_TOKEN} from '../../core/auth';
import { FAILED_TO_AUTHENTICATE, PROCEED } from '../../core/messages';
import axios from 'axios';

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
            map.set(SEC_EXPIRES, pastDate.toString());
            map.set(SEC_REFRESH_TOKEN_USED, 'false');
            map.set(SEC_TOKEN, 'any');
            map.set(SEC_REFRESH_TOKEN, 'any');
            const result = await auth.getAuthState();
            assert.strictEqual(result, AuthState.TokenExpired);
        });

        it('should return TokenPresent if all conditions are valid and refresh token has not been used', async function () {
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1); // Set expires to be 1 year from now
            map.set(SEC_EXPIRES, futureDate.toString());
            map.set(SEC_REFRESH_TOKEN_USED, 'false');
            map.set(SEC_TOKEN, 'any');
            map.set(SEC_REFRESH_TOKEN, 'any');
            const result = await auth.getAuthState();
            assert.strictEqual(result, AuthState.TokenPresent);
        });

        it('should return TokenPresent when refreshTokenUsed is true, but expiration time has not passed', async function () {
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);
            map.set(SEC_EXPIRES, futureDate.toString());
            map.set(SEC_REFRESH_TOKEN_USED, 'true');
            map.set(SEC_TOKEN, 'any');
            map.set(SEC_REFRESH_TOKEN, 'any');
            const result = await auth.getAuthState();
            assert.strictEqual(result, AuthState.TokenPresent);
        });
    });

    describe('#resetTokens()', function () {
        it('should call delete method for each token', async function () {
            await auth.resetTokens();
            let stub = context.secrets.delete as sinon.SinonStub;
            assert.strictEqual(stub.callCount, 5);
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

            await auth.storeAuthTokens(tokenData);
            assert.strictEqual(map.get(SEC_TOKEN), 'access');
            assert.strictEqual(map.get(SEC_REFRESH_TOKEN), 'refresh');
            assert.strictEqual(map.get(SEC_EXPIRES), 'expires_at');
            assert.strictEqual(map.get(SEC_REFRESH_TOKEN_USED), 'false');
        });
    });

    describe('#getTokenToCloud()', function () {
        it('should return token when AuthState is TokenPresent', async function () {
            sandbox.stub(auth, 'getAuthState').resolves(AuthState.TokenPresent);
            map.set(SEC_TOKEN, 'token');

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
            assert.strictEqual(map.get(SEC_TOKEN), 'freshToken');
            assert.strictEqual(map.get(SEC_REFRESH_TOKEN), 'freshRefreshToken');
            assert.strictEqual(map.get(SEC_EXPIRES), '2021-01-01T00:00:00Z');
        });
    });
});