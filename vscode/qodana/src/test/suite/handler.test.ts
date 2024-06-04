import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { ShowMarkerHandler } from '../../core/handler';
import assert = require('assert');
import {CONF_PATH_PREFIX, CONF_PROJ_ID} from "../../core/config";
import {extensionInstance} from "../../core/extension";
import {AuthorizedImpl} from "../../core/auth/AuthorizedImpl";
import {Auth, AuthState} from "../../core/auth";
import {CloudEnvironment} from "../../core/cloud";

describe('URL Handler Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let context: vscode.ExtensionContext;
    let uris: vscode.Uri[] = [
        vscode.Uri.parse('vscode://jetbrains.qodana-code/showMarker?path=DFAchecks.cpp:255:1&cloud_project_id=ADwgY&cloud_report_id=ADwgY&length=8'),
        vscode.Uri.parse('vscode://jetbrains.qodana-code/showMarker?path=DFAchecks.cpp:255:1'),
        vscode.Uri.parse('vscode://jetbrains.qodana-code/showMarker?path=DFAchecks.cpp:255:1&cloud_project_id=ADwgY&cloud_report_id=ADwgY&length=8&cloud_host=new.host'),
    ];
    let secretStorage: vscode.SecretStorage;
    let map = new Map<string, string>();
    let auth: Auth ;

	beforeEach(async () => {
		sandbox = sinon.createSandbox();
        secretStorage = {
            get: sandbox.stub().callsFake(async (key) => { return map.get(key); }),
            store: sandbox.stub().callsFake(async (key, value) => { map.set(key, value); }),
            delete: sandbox.stub().callsFake(async (key) => { map.delete(key); }),
            keys: sandbox.stub().callsFake(async () => { return Array.from(map.keys()); }),
            onDidChange: sandbox.stub(),
        } as vscode.SecretStorage;
        context = { secrets: secretStorage, workspaceState: {} , globalState: {} } as vscode.ExtensionContext;
        sandbox.stub(context, 'workspaceState').value({
            get: sandbox.stub().returns(''),
            update: sandbox.stub()
        } as any);
        sandbox.stub(context, 'globalState').value({
            get: sandbox.stub().callsFake((key: string) => {
                return map.get(key);
            }),
            update: sandbox.stub().callsFake((key: string, value: string) => {
                map.set(key, value);
            }),
        } as any);
        auth = await Auth.create(context);
        extensionInstance.auth = auth;
	});

	afterEach(() => {
		sandbox.restore();
	});

    it('1: Uri is invalid, nothing would happen', async () => {
        let showMarkerHandler = prepareHandler(true);
        let stub = sandbox.stub(vscode.workspace, 'openTextDocument').rejects();
        
        await showMarkerHandler.handleUri(uris[1]);
        sandbox.assert.notCalled(stub);
    });

    it('2: Uri is valid but user declines project id', async () => {
        let showMarkerHandler = prepareHandler(false);
        let stub = sandbox.stub(vscode.workspace, 'openTextDocument').rejects();
        
        await showMarkerHandler.handleUri(uris[0]);
        sandbox.assert.notCalled(stub);
    });

    it('3: Uri is valid, license is accepted and text is highlighted', async () => {
        let workspaceFolders: vscode.WorkspaceFolder[] = [];
        let workspaceFolder: vscode.WorkspaceFolder = {
            uri: vscode.Uri.file(''),
            name: 'project',
            index: 0
        };
        workspaceFolders.push(workspaceFolder);
        sandbox.stub(vscode.workspace, 'workspaceFolders').value(workspaceFolders);
        let showMarkerHandler = prepareHandler(true);
        sandbox.stub(vscode.workspace, 'openTextDocument').resolves();
        let called = false;
        sandbox.stub(vscode.window, 'showTextDocument').resolves({
            revealRange: sandbox.stub().callsFake((_: vscode.Range, __: vscode.TextEditorRevealType) => {
                called = true;
                return;
            }),
        } as any);
        await showMarkerHandler.handleUri(uris[0]);
        assert.strictEqual(called, true);
    });

    it('4: Uri is valid, unauthorized to new cloud host', async () => {
        let workspaceFolders: vscode.WorkspaceFolder[] = [];
        let workspaceFolder: vscode.WorkspaceFolder = {
            uri: vscode.Uri.file(''),
            name: 'project',
            index: 0
        };
        workspaceFolders.push(workspaceFolder);
        sandbox.stub(vscode.workspace, 'workspaceFolders').value(workspaceFolders);
        let showMarkerHandler = prepareHandler(true);
        sandbox.stub(vscode.workspace, 'openTextDocument').resolves();
        let called = false;
        sandbox.stub(vscode.window, 'showTextDocument').resolves({
            revealRange: sandbox.stub().callsFake((_: vscode.Range, __: vscode.TextEditorRevealType) => {
                called = true;
                return;
            }),
        } as any);
        sandbox.stub(auth, 'getAuthorized').callsFake(() => undefined);
        let logout = sandbox.stub(auth, 'logOut').resolves();

        const tokenData = {
            access: 'access',
            refresh: 'refresh',
            /* eslint-disable @typescript-eslint/naming-convention */
            expires_at: 'expires_at'
        };
        let emitter = new vscode.EventEmitter<AuthState>();
        sandbox.stub(emitter, 'fire').value(
            sandbox.stub().callsFake(async (_: string) => { return; })
        );
        let authorized = await AuthorizedImpl.create(context, emitter, new CloudEnvironment(), tokenData);

        let login = sandbox.stub(auth, 'logIn').resolves(authorized);
        await showMarkerHandler.handleUri(uris[2]);
        assert.strictEqual(called, true);
        sandbox.assert.called(logout);
        sandbox.assert.called(login);
    });

    it('5: Uri is valid, unauthorized to new cloud host with error', async () => {
        let workspaceFolders: vscode.WorkspaceFolder[] = [];
        let workspaceFolder: vscode.WorkspaceFolder = {
            uri: vscode.Uri.file(''),
            name: 'project',
            index: 0
        };
        workspaceFolders.push(workspaceFolder);
        sandbox.stub(vscode.workspace, 'workspaceFolders').value(workspaceFolders);
        let showMarkerHandler = prepareHandler(true);
        let stub = sandbox.stub(vscode.workspace, 'openTextDocument').resolves();

        sandbox.stub(auth, 'getAuthorized').callsFake(() => undefined);
        sandbox.stub(auth, 'logOut').resolves();

        sandbox.stub(auth, 'logIn').resolves(null);
        await showMarkerHandler.handleUri(uris[2]);
        sandbox.assert.notCalled(stub);
    });

    it('6: Uri is valid, same cloud host', async () => {
        let workspaceFolders: vscode.WorkspaceFolder[] = [];
        let workspaceFolder: vscode.WorkspaceFolder = {
            uri: vscode.Uri.file(''),
            name: 'project',
            index: 0
        };
        workspaceFolders.push(workspaceFolder);
        sandbox.stub(vscode.workspace, 'workspaceFolders').value(workspaceFolders);
        let showMarkerHandler = prepareHandler(true);
        sandbox.stub(vscode.workspace, 'openTextDocument').resolves();
        let called = false;
        sandbox.stub(vscode.window, 'showTextDocument').resolves({
            revealRange: sandbox.stub().callsFake((_: vscode.Range, __: vscode.TextEditorRevealType) => {
                called = true;
                return;
            }),
        } as any);

        const tokenData = {
            access: 'access',
            refresh: 'refresh',
            /* eslint-disable @typescript-eslint/naming-convention */
            expires_at: 'expires_at'
        };
        let emitter = new vscode.EventEmitter<AuthState>();
        sandbox.stub(emitter, 'fire').value(
            sandbox.stub().callsFake(async (_: string) => { return; })
        );
        let authorized = await AuthorizedImpl.create(context, emitter, new CloudEnvironment('new.host'), tokenData);

        sandbox.stub(auth, 'getAuthorized').callsFake(() => authorized);
        let logout = sandbox.stub(auth, 'logOut').resolves();
        let login = sandbox.stub(auth, 'logIn').resolves(null);
        await showMarkerHandler.handleUri(uris[2]);
        assert.strictEqual(called, true);
        sandbox.assert.notCalled(logout);
        sandbox.assert.notCalled(login);
    });

    function prepareHandler(projectIdNotSet: boolean) {
        let showMarkerHandler = new ShowMarkerHandler(context);
        sandbox.stub(showMarkerHandler, 'projectIdNotSet').returns(Promise.resolve(projectIdNotSet));
        sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: sandbox.stub().callsFake((key: string) => {
                if (key === CONF_PROJ_ID) {
                    return 'ADwgY';
                } else if (key === CONF_PATH_PREFIX) {
                    return '';
                }
                return false;
            }),
            update: sandbox.stub()
        } as any);
        sandbox.stub(vscode.window, 'showErrorMessage');
        return showMarkerHandler;
    }
});