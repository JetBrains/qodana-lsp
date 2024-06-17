import * as vscode from 'vscode';
import * as sinon from 'sinon';
import {
    getLanguagesInWorkspace,
    getLinters,
    getLinterByCode,
    selectLinter,
    versionPrefix
} from '../../core/cli/language'; // Update this path
import assert = require('assert');

describe('Language/Linter Selection Tests', () => {
    const sandbox = sinon.createSandbox();
    const fakeFilesData = [
        vscode.Uri.file('/testFolder/testFile.java'),
        vscode.Uri.file('/testFolder/testFile.py'),
    ];

    beforeEach(() => {
        sandbox.stub(vscode.workspace, 'findFiles').resolves(fakeFilesData as any);
        sandbox.stub(vscode.workspace, 'asRelativePath').callsFake(uri => uri.toString());
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('1: getLanguagesInWorkspace should return correct languages', async () => {
        const langs = await getLanguagesInWorkspace();
        assert.ok(arraysAreEqual(langs, ['Java', 'Kotlin', 'Python']));
    });

    it('2: getLinters should segregate community and paid linters', () => {
        const testLangs = ['Java', 'TypeScript'];
        const { communityLinters, paidLinters } = getLinters(testLangs);
        assert.ok(arraysAreEqual(communityLinters, ['QDJVMC', 'QDANDC']));
        assert.ok(arraysAreEqual(paidLinters, ['QDJVM', 'QDJS']), paidLinters.toString());
    });

    it('3: getLinterByCode should return correct Docker image with versioned prefix tag', () => {
        const linterCode = 'QDPY';
        const linterImage = getLinterByCode(linterCode);
        assert.equal(linterImage, 'jetbrains/qodana-python:' + versionPrefix);
    });

    it('4: getLinterByCode should return undefined for invalid code', () => {
        const linterCode = 'INVALIDCODE';
        const linterImage = getLinterByCode(linterCode);
        assert.equal(linterImage, undefined);
    });

    it('5: selectLinter should return correct linter when there is only one', async () => {
        const choiceStub = sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);
        const communityLinters = ['QDJVMC'];
        const paidLinters: string[] = [];

        const result = await selectLinter('', communityLinters, paidLinters);
        assert.equal(result, 'QDJVMC');
        assert.equal(choiceStub.called, false);
    });

    it('6: selectLinter should return undefined when no linters are available', async () => {
        const choiceStub = sandbox.stub(vscode.window, 'showInformationMessage').resolves(undefined);
        const communityLinters: string[] = [];
        const paidLinters: string[] = [];

        const result = await selectLinter('', communityLinters, paidLinters);
        assert.equal(result, undefined);
        assert.equal(choiceStub.called, false);
    });

    it('7: selectLinter should handle user cancellation correctly', async () => {
        const choiceStub = sandbox.stub(vscode.window, 'showQuickPick').resolves(undefined);
        const communityLinters = ['QDJVMC'];
        const paidLinters = ['QDJS'];

        const result = await selectLinter('validToken', communityLinters, paidLinters);
        assert.equal(result, undefined);
        assert.equal(choiceStub.called, true);
    });

    it('8: selectLinter should return correct linter when there are multiple linters', async () => {
        const choiceStub = sandbox.stub(vscode.window, 'showQuickPick').resolves({label: 'QDJVM'} as any);
        const communityLinters = ['QDJVMC', 'QDANDC'];
        const paidLinters = ['QDJVM', 'QDJS'];

        const result = await selectLinter('validToken', communityLinters, paidLinters);
        assert.equal(result, 'QDJVM');
        assert.equal(choiceStub.called, true);
    });

    function arraysAreEqual<T>(arr1: T[], arr2: T[]): boolean {
        if (arr1.length !== arr2.length) { return false; }
        for (let i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) { return false; }
        }
        return true;
    }
});
