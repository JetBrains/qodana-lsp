import * as sinon from 'sinon';
import * as vscode from 'vscode';
import assert = require('assert');
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { downloadAndUnpackCli, getCli } from '../../core/cli/cliDownloader';
import { NO } from '../../core/messages';
import {GS_CLI_SETTING, GS_VER_SETTING} from '../../core/config';
import { version } from '../../core/cli/cli.json';

describe('CLI Downloader', () => {
    let sandbox: sinon.SinonSandbox;
    let map = new Map<string, string>();
    let context: vscode.ExtensionContext;

	beforeEach(async () => {
		sandbox = sinon.createSandbox();
        context = { globalState: {} } as vscode.ExtensionContext;
        sandbox.stub(context, 'globalState').value({
            get: sandbox.stub().callsFake((key: string) => {
                return map.get(key);
            }),
            update: sandbox.stub().callsFake((key: string, value: string) => {
                map.set(key, value);
            }),
        } as any);
	});

	afterEach(() => {
        map.clear();
    	sandbox.restore();
	});

    it('1: Release is downloadable', async () => {
        const dir1 = path.join(os.tmpdir(), Math.random().toString(36).substring(7));
        const dir2 = path.join(os.tmpdir(), Math.random().toString(36).substring(7));
        try {
            await fs.promises.mkdir(dir1, { recursive: true });
            await fs.promises.mkdir(dir2, { recursive: true });
            let cliPath = await downloadAndUnpackCli(dir1, dir2);
            assert.strictEqual(cliPath !== undefined, true);
            await fs.promises.access(cliPath!);
        } catch (e) {
            assert.fail('Failed to download and unpack the CLI');
        } finally {
            await fs.promises.rm(dir1, { recursive: true });
            await fs.promises.rm(dir2, { recursive: true });
        }
    });

    it('2: Existing CLI of current version is reused', async () => {
        const cliPath = path.join(os.tmpdir(), Math.random().toString(36).substring(7));
        try {
            await fs.promises.writeFile(cliPath, 'test');
            map.set(GS_VER_SETTING, version);
            map.set(GS_CLI_SETTING, cliPath);
            let stub = sandbox.stub(vscode.window, 'showErrorMessage').returns(NO as any);
            let result = await getCli(context);
            assert.strictEqual(stub.calledOnce, false);
            assert.strictEqual(result, cliPath);
            assert.strictEqual(map.get(GS_CLI_SETTING), cliPath);
        } catch (e) {
            assert.fail('Failed to reuse the existing CLI');
        } finally {
            await fs.promises.rm(cliPath);
        }
    });

    it('3: Existing CLI of old version is requested to update and reused if declined', async () => {
        const cliPath = path.join(os.tmpdir(), Math.random().toString(36).substring(7));
        try {
            await fs.promises.writeFile(cliPath, 'test');
            map.set(GS_VER_SETTING, 'other');
            map.set(GS_CLI_SETTING, cliPath);
            let stub = sandbox.stub(vscode.window, 'showErrorMessage').returns(NO as any);
            let result = await getCli(context);
            assert.strictEqual(stub.calledOnce, true);
            assert.strictEqual(result, cliPath);
            assert.strictEqual(map.get(GS_CLI_SETTING), cliPath);
            assert.strictEqual(map.get(GS_VER_SETTING), 'other');
        } catch (e) {
            assert.fail('Failed to reuse the existing CLI');
        } finally {
            await fs.promises.rm(cliPath);
        }
    });

    it('4: Non-existing CLI is not reused', async () => {
        const cliPath = path.join(os.tmpdir(), Math.random().toString(36).substring(7));
        try {
            map.set(GS_CLI_SETTING, cliPath);
            let stub = sandbox.stub(vscode.window, 'showErrorMessage').returns(NO as any);
            let result = await getCli(context);
            assert.strictEqual(stub.calledOnce, true);
            assert.strictEqual(result, undefined);
            assert.strictEqual(map.get(GS_CLI_SETTING), undefined);
        } catch (e) {
            assert.fail('Non-existing CLI reused');
        }
    });
});