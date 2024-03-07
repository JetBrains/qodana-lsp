import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as fs from 'fs';
import assert = require('assert');
import { launchTerminal, prepareRun, runQodana } from '../../core/cli/executor';

describe('Language/Linter Selection Tests', () => {
    const sandbox = sinon.createSandbox();
    
    beforeEach(() => {
        sandbox.stub(vscode.workspace, 'asRelativePath').callsFake(uri => uri.toString());
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('1: launchTerminal passes correct arguments', async () => {
        let opts: vscode.TerminalOptions = {} as vscode.TerminalOptions;
        let commands = Array<string>();
        let terminal: vscode.Terminal = {} as vscode.Terminal;
        sandbox.stub(vscode.window, 'createTerminal').callsFake((options: vscode.TerminalOptions) => {
            opts = options;
            terminal = { show: () => {}, sendText: (command: string) => {
                commands.push(command);
            }, exitStatus: { code: 123 }} as vscode.Terminal;
            return terminal;
        });
        sandbox.stub(vscode.window, 'onDidCloseTerminal').callsFake((callback: (closedTerminal: vscode.Terminal) => void) => {
            callback(terminal);
            return { dispose: () => {} };
        });

        let exitStatus = await launchTerminal('cli', 'cwd', 'tempDir', 'token');
        assert.equal(exitStatus, 123);
        assert.equal(opts.env?.QODANA_TOKEN, 'token');
        assert.equal(opts.env?.NONINTERACTIVE, '1');
        assert.equal(opts.cwd, 'cwd');
        assert.equal(commands.length, 2);
        assert.equal(commands[0], 'cli scan --results-dir tempDir --user root');
        assert.equal(commands[1], '; exit');
    });

    it('2: prepareRun returns true if linter is found in qodana.yaml', async () => {
        sandbox.stub(vscode.workspace, 'findFiles').resolves([vscode.Uri.file('/testFolder/qodana.yaml')]);
        sandbox.stub(vscode.workspace, 'fs').value({
            readFile: async (_: vscode.Uri) => {
                return new TextEncoder().encode('linter: myLinter');
            }
        });
        let result = await prepareRun('token');
        assert.equal(result, true);
    });

    it('2: prepareRun returns true if ide is found in qodana.yaml', async () => {
        sandbox.stub(vscode.workspace, 'findFiles').resolves([vscode.Uri.file('/testFolder/qodana.yaml')]);
        sandbox.stub(vscode.workspace, 'fs').value({
            readFile: async (_: vscode.Uri) => {
                return new TextEncoder().encode('ide: myIde');
            }
        });
        let result = await prepareRun('token');
        assert.equal(result, true);
    });

    it('3: prepareRun returns false if no linters are found in the workspace', async () => {
        sandbox.stub(vscode.workspace, 'findFiles').resolves([]);
        let result = await prepareRun('token');
        assert.equal(result, false);
    });

    it('4: prepareRun returns true if linter is found in workspace', async () => {
        sandbox.stub(vscode.workspace, 'findFiles').resolves([vscode.Uri.file('/testFolder/testFile.java'), vscode.Uri.file('/testFolder/testFile.py')]);
        let writtenText = '';
        sandbox.stub(vscode.workspace, 'workspaceFolders').value([{ uri: { fsPath: '/testFolder' } }]);
        sandbox.stub(vscode.workspace, 'fs').value({
            writeFile: async (_: vscode.Uri, data: Uint8Array) => {
                writtenText = new TextDecoder().decode(data);
            },
            stat: sandbox.stub().resolves(null),
        });

        const choiceStub = sandbox.stub(vscode.window, 'showInformationMessage').resolves('QDJVM (Java)' as any);
        let result = await prepareRun('token');
        assert.equal(result, true);
        assert.equal(choiceStub.called, true);
        assert.equal(writtenText, 'linter: jetbrains/qodana-jvm:latest');
    });

    it('5: runQodana calls prepareRun and launchTerminal', async () => {
        let commands = Array<string>();
        let terminal: vscode.Terminal = {} as vscode.Terminal;
        sandbox.stub(vscode.window, 'createTerminal').callsFake((_: vscode.TerminalOptions) => {
            terminal = { show: () => {}, sendText: (command: string) => {
                commands.push(command);
            }, exitStatus: { code: 123 }} as vscode.Terminal;
            return terminal;
        });
        sandbox.stub(vscode.window, 'onDidCloseTerminal').callsFake((callback: (closedTerminal: vscode.Terminal) => void) => {
            callback(terminal);
            return { dispose: () => {} };
        });
        sandbox.stub(vscode.workspace, 'findFiles').resolves([vscode.Uri.file('/testFolder/qodana.yaml')]);
        sandbox.stub(vscode.workspace, 'workspaceFolders').value([{ uri: { fsPath: '/testFolder' } }]);
        sandbox.stub(vscode.workspace, 'fs').value({
            readFile: async (_: vscode.Uri) => {
                return new TextEncoder().encode('linter: myLinter');
            }
        });
        sandbox.stub(fs.promises, 'mkdir').resolves();
        let statusStub = sandbox.stub(vscode.window, 'showInformationMessage').resolves();
        await runQodana('cli', 'token');
        assert.equal(statusStub.called, true);
    });
});
