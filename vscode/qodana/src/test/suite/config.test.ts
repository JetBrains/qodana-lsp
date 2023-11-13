import * as vscode from 'vscode';
import * as sinon from 'sinon';
import assert = require('assert');

import config from '../../core/config';
import { QodanaExtension } from '../../core/extension';
import { PROCEED, RELOAD, ULS_PROCEED } from '../../core/messages';
import { State } from "vscode-languageclient/node";

describe('Configuration Test Suite', () => {
    var sandbox: sinon.SinonSandbox;
    let map = new Map<string, string>();
    let globalMap = new Map<string, string>();

    beforeEach(async () => {
        sandbox = sinon.createSandbox();
        sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: sandbox.stub().callsFake((key: string) => {
                return map.get(key);
            }),
            update: sandbox.stub().callsFake((key: string, value: string) => {
                map.set(key, value);
            }),
            inspect: sandbox.stub().callsFake((key: string) => {
                return {
                    globalValue: globalMap.get(key),
                };
            }),
        } as any);
    });

    afterEach(() => {
        sandbox.restore();
        map.clear();
        globalMap.clear();
    });

    it('1: Project id is not set', async () => {
        map.set('qodana.projectId', '');
        map.set('qodana.pathPrefix', '');
        let stub = sandbox.stub(vscode.window, 'showInformationMessage').resolves();
        let result = await config.configIsValid({} as any, false);
        assert.strictEqual(result, false);
        sandbox.assert.calledOnce(stub);
    });

    it('2: Project id is set, but path prefix points to non-existing directory', async () => {
        map.set('qodana.projectId', 'ADwgY');
        map.set('qodana.pathPrefix', 'non-existing');
        let stub = sandbox.stub(vscode.window, 'showInformationMessage').resolves();
        let result = await config.configIsValid({} as any, false);
        assert.strictEqual(result, false);
        sandbox.assert.calledOnce(stub);
    });

    it('3: Project id is set, path prefix is set and points to existing directory', async () => {
        map.set('qodana.projectId', 'ADwgY');
        map.set('qodana.pathPrefix', '');
        let stub = sandbox.stub(vscode.window, 'showInformationMessage').resolves();
        let result = await config.configIsValid({} as any, false);
        assert.strictEqual(result, true);
        sandbox.assert.notCalled(stub);
    });

    it('4: Global settings are set, asked to reset', async () => {
        globalMap.set('qodana.projectId', 'ADwgY');
        let stub = sandbox.stub(vscode.window, 'showErrorMessage').returns(ULS_PROCEED as any);
        sandbox.stub(vscode.workspace, 'onDidChangeConfiguration').callsFake((callback: (e: vscode.ConfigurationChangeEvent) => any, text?: any, disable?: any): any => {
            callback({ affectsConfiguration: (section: string) => { return section === 'qodana'; } });
        });
        config.sectionChangeHandler(QodanaExtension.instance.languageClient!, {} as any);
        sandbox.assert.calledOnce(stub);
    });

    it('5: Global settings are set, asked to reset, reset is confirmed', async () => {
        let promise = new Promise((resolve) => {
            sandbox.stub(vscode.workspace, 'onDidChangeConfiguration').callsFake((callback: (e: vscode.ConfigurationChangeEvent) => any, text?: any, disable?: any): any => {
                callback({ affectsConfiguration: (section: string) => { return section === 'qodana'; } }).then(() => {
                    resolve(true);
                });
            });
        });
        globalMap.set('qodana.projectId', 'ADwgY');
        sandbox.stub(vscode.window, 'showErrorMessage').resolves(PROCEED as any);
        let stub = sandbox.stub(config, 'resetGlobalSettings').resolves();
        let notCalled = sandbox.stub(config, 'configIsValid').rejects();
        config.sectionChangeHandler(QodanaExtension.instance.languageClient!, {} as any);
        await promise;
        sandbox.assert.calledOnce(stub);
        sandbox.assert.notCalled(notCalled);
    });

    it('6: Global settings are not set, client is running, config is valid', async () => {
        let promise = new Promise((resolve) => {
            sandbox.stub(vscode.workspace, 'onDidChangeConfiguration').callsFake((callback: (e: vscode.ConfigurationChangeEvent) => any, text?: any, disable?: any): any => {
                callback({ affectsConfiguration: (section: string) => { return section === 'qodana'; } }).then(() => {
                    resolve(true);
                });
            });
        });
        
        sandbox.stub(QodanaExtension.instance, 'languageClient').value({ state: null, stop: null, start: null } as any);
        let notCalled1 = sandbox.stub(QodanaExtension.instance.languageClient!, 'stop').resolves();
        let notCalled2 = sandbox.stub(QodanaExtension.instance.languageClient!, 'start').resolves();
        sandbox.stub(config, 'configIsValid').resolves(true);

        let client = QodanaExtension.instance.languageClient!;
        sandbox.stub(client, 'state').value(State.Running);
        sandbox.stub(vscode.window, 'showInformationMessage').resolves(RELOAD as any);
        let stub = sandbox.stub(vscode.commands, 'executeCommand').resolves();
        config.sectionChangeHandler(client, {} as any);
        await promise;
        sandbox.assert.calledOnce(stub);
        sandbox.assert.notCalled(notCalled1);
        sandbox.assert.notCalled(notCalled2);
    });
});