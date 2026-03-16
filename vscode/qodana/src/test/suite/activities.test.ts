import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { State } from 'vscode-languageclient/node';
import { onConfigChange } from '../../core/client/activities';
import config, { WS_OPENED_REPORT } from '../../core/config';
import { Events } from '../../core/events';

describe('Activities Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let context: vscode.ExtensionContext;
    let mockClient: any;
    let wsState: Map<string, any>;
    let startTimerStub: sinon.SinonStub;
    let stopTimerStub: sinon.SinonStub;
    let originalEventsInstance: any;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        // Reset Events singleton to avoid handler accumulation across tests
        originalEventsInstance = (Events as any)._instance;
        (Events as any)._instance = undefined;

        wsState = new Map();
        context = { workspaceState: {} } as any;
        sandbox.stub(context, 'workspaceState').value({
            get: sandbox.stub().callsFake((key: string, defaultValue?: any) => {
                return wsState.has(key) ? wsState.get(key) : defaultValue;
            }),
            update: sandbox.stub().callsFake(async (key: string, value: any) => {
                wsState.set(key, value);
            })
        } as any);

        mockClient = {
            state: State.Running,
        };

        sandbox.stub(config, 'configIsValid').resolves(true);

        startTimerStub = sandbox.stub(Events.instance, 'startTimer');
        stopTimerStub = sandbox.stub(Events.instance, 'stopTimer');
    });

    afterEach(() => {
        (Events as any)._instance = originalEventsInstance;
        sandbox.restore();
    });

    it('onConfigChange fires timer immediately when no report is open', async () => {
        onConfigChange(mockClient as any, context);
        Events.instance.fireConfigChange();

        await new Promise(resolve => setTimeout(resolve, 10));

        sinon.assert.calledWith(startTimerStub, 5 * 60 * 1000, true);
    });

    it('onConfigChange does not fire timer immediately when report is open', async () => {
        wsState.set(WS_OPENED_REPORT, '/some/report/path');

        onConfigChange(mockClient as any, context);
        Events.instance.fireConfigChange();

        await new Promise(resolve => setTimeout(resolve, 10));

        sinon.assert.calledWith(startTimerStub, 5 * 60 * 1000, false);
    });

    it('onProjectLinked never fires timer immediately', async () => {
        onConfigChange(mockClient as any, context);
        Events.instance.fireProjectLinked();

        await new Promise(resolve => setTimeout(resolve, 10));

        sinon.assert.calledWith(startTimerStub, 5 * 60 * 1000, false);
    });
});
