import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { obtainToken } from '../../core/cli/token';
import { QODANA_TOKEN } from '../../core/auth';

describe('obtainToken', () => {
  let sandbox: sinon.SinonSandbox;
  let context: vscode.ExtensionContext;
  let secrets: vscode.SecretStorage;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    context = {
      secrets: {
        get: sandbox.stub(),
        store: sandbox.stub(),
        delete: sandbox.stub(),
        onDidChange: sandbox.stub()
      }
    } as unknown as vscode.ExtensionContext;
    secrets = context.secrets as vscode.SecretStorage;
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('1: should prompt the user for a token if it is not set', async () => {
    const fakeToken = 'userToken';
    // eslint-disable-next-line @typescript-eslint/naming-convention
    sandbox.stub(process, 'env').value({ QODANA_TOKEN: undefined });
    (secrets.get as sinon.SinonStub).resolves(undefined);
    sandbox.stub(vscode.window, 'showInputBox').resolves(fakeToken);

    const token = await obtainToken(context);
    assert.strictEqual(token, fakeToken);
    sinon.assert.calledOnceWithExactly(secrets.get as sinon.SinonStub, QODANA_TOKEN);
    sinon.assert.calledOnce(vscode.window.showInputBox as sinon.SinonStub);
    sinon.assert.calledOnceWithExactly(secrets.store as sinon.SinonStub, QODANA_TOKEN, fakeToken);
  });

  it('2: should not store the token if the user cancels the input prompt', async () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    sandbox.stub(process, 'env').value({ QODANA_TOKEN: undefined });
    (secrets.get as sinon.SinonStub).resolves(undefined);
    sandbox.stub(vscode.window, 'showInputBox').resolves(undefined);

    const token = await obtainToken(context);
    assert.strictEqual(token, undefined);
    sinon.assert.calledOnceWithExactly(secrets.get as sinon.SinonStub, QODANA_TOKEN);
    sinon.assert.calledOnce(vscode.window.showInputBox as sinon.SinonStub);
    sinon.assert.notCalled(secrets.store as sinon.SinonStub);
  });
});