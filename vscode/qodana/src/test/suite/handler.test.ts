import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { ShowMarkerHandler } from '../../core/handler';
import assert = require('assert');

describe('URL Handler Test Suite', () => {
    var sandbox: sinon.SinonSandbox;
    let context: vscode.ExtensionContext;
    let uris: vscode.Uri[] = [
        vscode.Uri.parse('vscode://jetbrains.qodana-code/showMarker?path=DFAchecks.cpp:255:1&cloud_project_id=ADwgY&length=8'),
        vscode.Uri.parse('vscode://jetbrains.qodana-code/showMarker?path=DFAchecks.cpp:255:1'),
    ];

	beforeEach(async () => {
		sandbox = sinon.createSandbox();
        context = { workspaceState: {} } as vscode.ExtensionContext;
        sandbox.stub(context, 'workspaceState').value({
            get: sandbox.stub().returns(''),
            update: sandbox.stub()
        } as any);
	});

	afterEach(() => {
		sandbox.restore();
	});

    it('1: Uri is invalid, nothing would happen', async () => {
        let showMarkerHandler = new ShowMarkerHandler(context);
        sandbox.stub(showMarkerHandler, 'projectIdNotSet').returns(Promise.resolve(true));
        sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: sandbox.stub().callsFake((key: string) => {
                if (key === 'qodana.projectId') {
                    return 'ADwgY';
                } else if (key === 'qodana.pathPrefix') {
                    return '';
                }
                return false;
            }),
            update: sandbox.stub()
        } as any);
        sandbox.stub(vscode.window, 'showErrorMessage');
        let stub = sandbox.stub(vscode.workspace, 'openTextDocument').rejects();
        
        await showMarkerHandler.handleUri(uris[1]);
        sandbox.assert.notCalled(stub);
    });

    it('2: Uri is valid but user declines project id', async () => {
        let showMarkerHandler = new ShowMarkerHandler(context);
        sandbox.stub(showMarkerHandler, 'projectIdNotSet').returns(Promise.resolve(false));
        sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: sandbox.stub().callsFake((key: string) => {
                if (key === 'qodana.projectId') {
                    return 'ADwgY';
                } else if (key === 'qodana.pathPrefix') {
                    return '';
                }
                return false;
            }),
            update: sandbox.stub()
        } as any);
        sandbox.stub(vscode.window, 'showErrorMessage');
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
        let showMarkerHandler = new ShowMarkerHandler(context);
        sandbox.stub(showMarkerHandler, 'projectIdNotSet').returns(Promise.resolve(true));
        sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: sandbox.stub().callsFake((key: string) => {
                if (key === 'qodana.projectId') {
                    return 'ADwgY';
                } else if (key === 'qodana.pathPrefix') {
                    return '';
                }
                return false;
            }),
            update: sandbox.stub()
        } as any);
        sandbox.stub(vscode.window, 'showErrorMessage');
        sandbox.stub(vscode.workspace, 'openTextDocument').resolves();
        let called = false;
        sandbox.stub(vscode.window, 'showTextDocument').resolves({
            revealRange: sandbox.stub().callsFake((range: vscode.Range, revealType: vscode.TextEditorRevealType) => {
                called = true;
                return;
            }),
        } as any);
        await showMarkerHandler.handleUri(uris[0]);
        assert.strictEqual(called, true);
    });
});