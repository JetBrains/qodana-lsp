import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {State} from 'vscode-languageclient/node';

import config, {
    CONF_PATH_PREFIX,
    CONF_PROJ_ID,
} from '../../core/config';
import {Events} from '../../core/events';
import {
    onConfigChange,
    onServerStateChange,
    onTimerCallback,
    onUrlCallback
} from '../../core/client/activities';
import {LinkService} from '../../core/cloud/link';
import {extensionInstance} from '../../core/extension';
import {ShowMarkerHandler} from '../../core/handler';
import {ID_SET} from '../../core/messages';

describe('Regression Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let clock: sinon.SinonFakeTimers | undefined;
    let context: vscode.ExtensionContext;
    let configValues: Map<string, unknown>;
    let workspaceStateValues: Map<string, unknown>;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        resetEventsSingleton();

        configValues = new Map<string, unknown>([
            [CONF_PROJ_ID, 'ADwgY'],
            [CONF_PATH_PREFIX, ''],
        ]);
        workspaceStateValues = new Map<string, unknown>();
        context = createContext();

        sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: sandbox.stub().callsFake((key: string) => configValues.get(key)),
            update: sandbox.stub().callsFake(async (key: string, value: unknown) => {
                if (value === undefined) {
                    configValues.delete(key);
                } else {
                    configValues.set(key, value);
                }
            }),
            inspect: sandbox.stub().returns({globalValue: undefined}),
        } as any);
        sandbox.stub(vscode.workspace, 'onDidChangeConfiguration').returns({dispose: () => { return; }} as vscode.Disposable);
        sandbox.stub(vscode.workspace, 'workspaceFolders').value([
            {uri: vscode.Uri.file('/workspace'), name: 'workspace', index: 0}
        ] as vscode.WorkspaceFolder[]);
        sandbox.stub(vscode.commands, 'executeCommand').resolves();
        sandbox.stub(vscode.window, 'showInformationMessage').resolves();

        extensionInstance.auth = undefined;
        extensionInstance.languageClient = undefined;
        extensionInstance.linkService = undefined;
        extensionInstance.localRunService = undefined;
        extensionInstance.reportService = undefined;
    });

    afterEach(() => {
        resetEventsSingleton();
        sandbox.restore();
        extensionInstance.auth = undefined;
        extensionInstance.languageClient = undefined;
        extensionInstance.linkService = undefined;
        extensionInstance.localRunService = undefined;
        extensionInstance.reportService = undefined;
        clock = undefined;
    });

    it('fetches the latest report immediately on startup for a linked workspace without cached report state', async () => {
        const authorized = createAuthorizedApi({
            getProjectProperties: async () => ({id: 'ADwgY', organizationId: 'org', name: 'Project A'}),
        });
        extensionInstance.auth = {
            getAuthorized: sandbox.stub().returns(authorized),
        } as any;

        const openLatestReport = sandbox.stub();
        extensionInstance.reportService = {
            openReportByProjectId: openLatestReport,
            openReportById: sandbox.stub().resolves(),
        } as any;
        const client = {
            state: State.Running,
        } as any;

        const linkService = await LinkService.create(context);
        extensionInstance.linkService = linkService;

        sandbox.stub(config, 'configIsValid').resolves(true);

        onTimerCallback(context, extensionInstance.auth as any);
        onConfigChange(client, context);
        onServerStateChange(context);

        Events.instance.fireServerStateChange(State.Running);
        await flushAsync();

        assert.strictEqual(linkService.getLinkedProjectId(), 'ADwgY');
        assert.ok(
            openLatestReport.callCount >= 1,
            'linked startup should fetch the latest report immediately instead of waiting for the first timer interval'
        );
    });

    it('keeps periodic report polling after opening a deep link for the already linked project', async () => {
        clock = sandbox.useFakeTimers({shouldClearNativeTimers: true} as any);

        const authorized = createAuthorizedApi({
            getReportId: async () => 'latest-report',
            getProjectProperties: async () => ({id: 'ADwgY', organizationId: 'org', name: 'Project A'}),
        });
        const auth = {
            getAuthorized: sandbox.stub().returns(authorized),
        } as any;
        extensionInstance.auth = auth;

        const openLatestReport = sandbox.stub();
        extensionInstance.reportService = {
            openReportByProjectId: openLatestReport,
            openReportById: sandbox.stub().resolves(),
        } as any;
        sandbox.stub(config, 'configIsValid').resolves(true);
        sandbox.stub(vscode.workspace, 'openTextDocument').resolves({} as vscode.TextDocument);
        sandbox.stub(vscode.window, 'showTextDocument').resolves({
            revealRange: sandbox.stub(),
        } as any);

        const client = {
            state: State.Running,
        } as any;

        onTimerCallback(context, auth);
        onConfigChange(client, context);
        onUrlCallback(context, auth);

        Events.instance.fireServerStateChange(State.Running);
        await flushAsync();
        await clock.tickAsync(5 * 60 * 1000);

        const sameProjectUri = vscode.Uri.parse(
            'vscode://jetbrains.qodana-code/showMarker?path=DFAchecks.cpp:255:1&cloud_project_id=ADwgY&cloud_report_id=report-42&length=8'
        );
        const handler = new ShowMarkerHandler(context);
        await handler.handleUri(sameProjectUri);
        await flushAsync();

        await clock.tickAsync(5 * 60 * 1000);

        assert.ok(
            openLatestReport.callCount >= 2,
            'opening a same-project deep link should not permanently stop the background refresh timer'
        );
    });

    it('keeps the current link and report when relinking to the deep-linked project fails', async () => {
        configValues.set(CONF_PROJ_ID, 'CURRENT');

        const authorized = createAuthorizedApi({
            getProjectProperties: async (projectId: string) => {
                if (projectId === 'CURRENT') {
                    return {id: 'CURRENT', organizationId: 'org', name: 'Current Project'};
                }
                return undefined;
            },
        });
        extensionInstance.auth = {
            getAuthorized: sandbox.stub().returns(authorized),
        } as any;

        const closeReport = sandbox.stub(extensionInstance, 'closeReport').resolves();
        sandbox.stub(vscode.workspace, 'openTextDocument').resolves({} as vscode.TextDocument);
        sandbox.stub(vscode.window, 'showTextDocument').resolves({
            revealRange: sandbox.stub(),
        } as any);
        sandbox.stub(vscode.window, 'showErrorMessage').resolves(ID_SET as any);

        const linkService = await LinkService.create(context);
        extensionInstance.linkService = linkService;

        const differentProjectUri = vscode.Uri.parse(
            'vscode://jetbrains.qodana-code/showMarker?path=DFAchecks.cpp:255:1&cloud_project_id=NEW&cloud_report_id=report-99&length=8'
        );
        const handler = new ShowMarkerHandler(context);

        await handler.handleUri(differentProjectUri);

        assert.strictEqual(linkService.getLinkedProjectId(), 'CURRENT');
        sandbox.assert.notCalled(closeReport);
    });

    function createContext(): vscode.ExtensionContext {
        return {
            workspaceState: {
                get: sandbox.stub().callsFake((key: string) => workspaceStateValues.get(key)),
                update: sandbox.stub().callsFake(async (key: string, value: unknown) => {
                    workspaceStateValues.set(key, value);
                }),
            },
            globalState: {
                get: sandbox.stub().returns(undefined),
                update: sandbox.stub().resolves(),
            },
            extension: {
                packageJSON: {
                    version: '1.1.6',
                },
            },
        } as any as vscode.ExtensionContext;
    }

    function createAuthorizedApi(impl: {
        getProjectProperties?: (projectId: string, withError?: boolean) => Promise<unknown>,
        getReportId?: (projectId: string) => Promise<unknown>,
    }) {
        const api = {
            getProjectProperties: impl.getProjectProperties ?? (async () => undefined),
            getReportId: impl.getReportId ?? (async () => undefined),
        };
        return {
            environment: {frontendUrl: 'https://qodana.cloud'},
            qodanaCloudUserApi: async <T>(request: (apiObj: any) => Promise<T>) => request(api),
        } as any;
    }

    async function flushAsync() {
        await Promise.resolve();
        await Promise.resolve();
    }

    function resetEventsSingleton() {
        const instance = (Events as any)._instance;
        if (instance?.recurringTimer) {
            clearInterval(instance.recurringTimer);
        }
        (Events as any)._instance = undefined;
    }
});
