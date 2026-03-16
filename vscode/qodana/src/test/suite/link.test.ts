import * as vscode from 'vscode';
import * as sinon from 'sinon';
import assert = require('assert');
import { LinkService } from '../../core/cloud/link';
import { extensionInstance } from '../../core/extension';

describe('LinkService Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let context: vscode.ExtensionContext;
    let configMap: Map<string, any>;
    let mockGetProjectProperties: sinon.SinonStub;
    let originalAuth: any;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        configMap = new Map();

        context = { workspaceState: {}, globalState: {} } as vscode.ExtensionContext;
        sandbox.stub(context, 'workspaceState').value({
            get: sandbox.stub().returns(''),
            update: sandbox.stub()
        } as any);

        sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: sandbox.stub().callsFake((key: string) => configMap.get(key)),
            update: sandbox.stub().callsFake(async (key: string, value: any) => {
                if (value === undefined) {
                    configMap.delete(key);
                } else {
                    configMap.set(key, value);
                }
            })
        } as any);

        sandbox.stub(vscode.workspace, 'onDidChangeConfiguration');
        sandbox.stub(vscode.commands, 'executeCommand');

        mockGetProjectProperties = sandbox.stub();
        originalAuth = extensionInstance.auth;
        extensionInstance.auth = {
            getAuthorized: () => ({
                qodanaCloudUserApi: async (fn: any) => fn({ getProjectProperties: mockGetProjectProperties })
            })
        } as any;

        sandbox.stub(extensionInstance, 'closeReport').resolves();
    });

    afterEach(() => {
        extensionInstance.auth = originalAuth;
        sandbox.restore();
    });

    it('linkProject restores previousProjectId on getProjectProperties failure', async () => {
        let service = await LinkService.create(context);

        // Link to projectA successfully
        mockGetProjectProperties.resolves({ name: 'Project A' });
        service.selectProject('projectA');
        await service.linkProject(false);
        assert.strictEqual(service.getLinkedProjectId(), 'projectA');

        // Try to link to projectB, but API fails
        mockGetProjectProperties.resolves(undefined);
        service.selectProject('projectB');
        await service.linkProject(false);

        // Should restore to projectA
        assert.strictEqual(service.getLinkedProjectId(), 'projectA');
    });

    it('getProjectProperties with withUnlink=true unlinks on failure', async () => {
        let service = await LinkService.create(context);

        // Link first
        mockGetProjectProperties.resolves({ name: 'Project A' });
        service.selectProject('projectA');
        await service.linkProject(false);
        assert.strictEqual(service.getLinkedProjectId(), 'projectA');

        // Call getProjectProperties with withUnlink=true, API returns null
        mockGetProjectProperties.resolves(undefined);
        await service.getProjectProperties(undefined, true, true);

        // Should have unlinked
        assert.strictEqual(service.getLinkedProjectId(), undefined);
    });

    it('getProjectProperties with withUnlink=false does not unlink on failure', async () => {
        let service = await LinkService.create(context);

        // Link first
        mockGetProjectProperties.resolves({ name: 'Project A' });
        service.selectProject('projectA');
        await service.linkProject(false);
        assert.strictEqual(service.getLinkedProjectId(), 'projectA');

        // Call getProjectProperties without withUnlink, API returns null
        mockGetProjectProperties.resolves(undefined);
        await service.getProjectProperties(undefined, true, false);

        // Should still be linked
        assert.strictEqual(service.getLinkedProjectId(), 'projectA');
    });
});
