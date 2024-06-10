import * as vscode from 'vscode';
import * as sinon from 'sinon';
import assert = require('assert');

import config, {CONF_PATH_PREFIX, CONF_PROJ_ID} from '../../core/config';
import { QodanaExtension } from '../../core/extension';
import { PROCEED, RELOAD, ULS_PROCEED } from '../../core/messages';
import { LanguageClient, State } from 'vscode-languageclient/node';

describe('Configuration Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
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
        map.set(CONF_PROJ_ID, '');
        map.set(CONF_PATH_PREFIX, '');
        let stub = sandbox.stub(vscode.window, 'showInformationMessage').resolves();
        let result = await config.configIsValid({} as any, false);
        assert.strictEqual(result, false);
        sandbox.assert.calledOnce(stub);
    });

    it('2: Project id is set, but path prefix points to non-existing directory', async () => {
        map.set(CONF_PROJ_ID, 'ADwgY');
        map.set(CONF_PATH_PREFIX, 'non-existing');
        let stub = sandbox.stub(vscode.window, 'showInformationMessage').resolves();
        let result = await config.configIsValid({} as any, false);
        assert.strictEqual(result, false);
        sandbox.assert.calledOnce(stub);
    });

    it('3: Project id is set, path prefix is set and points to existing directory', async () => {
        map.set(CONF_PROJ_ID, 'ADwgY');
        map.set(CONF_PATH_PREFIX, '');
        let stub = sandbox.stub(vscode.window, 'showInformationMessage').resolves();
        let result = await config.configIsValid({} as any, false);
        assert.strictEqual(result, true);
        sandbox.assert.notCalled(stub);
    });

    it('4: Global settings are set, asked to reset', async () => {
        globalMap.set(CONF_PROJ_ID, 'ADwgY');
        let stub = sandbox.stub(vscode.window, 'showErrorMessage').returns(ULS_PROCEED as any);
        sandbox.stub(vscode.workspace, 'onDidChangeConfiguration').callsFake((callback: (e: vscode.ConfigurationChangeEvent) => any, _: any, __: any): any => {
            callback({ affectsConfiguration: (section: string) => { return section === 'qodana'; } });
        });
        config.sectionChangeHandler(QodanaExtension.instance.languageClient!, {} as any);
        sandbox.assert.calledOnce(stub);
    });

    it('5: Global settings are set, asked to reset, reset is confirmed', async () => {
        let promise = new Promise((resolve) => {
            sandbox.stub(vscode.workspace, 'onDidChangeConfiguration').callsFake((callback: (e: vscode.ConfigurationChangeEvent) => any, _: any, __: any): any => {
                callback({ affectsConfiguration: (section: string) => { return section === 'qodana'; } }).then(() => {
                    resolve(true);
                });
            });
        });
        globalMap.set(CONF_PROJ_ID, 'ADwgY');
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
            sandbox.stub(vscode.workspace, 'onDidChangeConfiguration').callsFake((callback: (e: vscode.ConfigurationChangeEvent) => any, _: any, __: any): any => {
                callback({ affectsConfiguration: (section: string) => { return section === 'qodana'; } }).then(() => {
                    resolve(true);
                });
            });
        });
        
        let client = { state: State.Running, stop: null, start: null } as unknown as LanguageClient;
        let notCalled1 = sandbox.stub(client, 'stop').resolves();
        let notCalled2 = sandbox.stub(client, 'start').resolves();
        sandbox.stub(config, 'configIsValid').resolves(true);
        sandbox.stub(vscode.window, 'showInformationMessage').resolves(RELOAD as any);
        sandbox.stub(vscode.commands, 'executeCommand').resolves();
        config.sectionChangeHandler(client, {} as any);
        await promise;
        // sandbox.assert.calledOnce(stub); Todo rework test
        sandbox.assert.notCalled(notCalled1);
        sandbox.assert.notCalled(notCalled2);
    });
});