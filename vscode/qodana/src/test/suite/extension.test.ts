import * as assert from 'assert';

import * as vscode from 'vscode';

describe('Extension Test Suite', () => {
	it('Extension should be present', () => {
		assert.ok(vscode.extensions.getExtension('jetbrains.qodana-code'));
	});

	it('Extension registered commands should be present', async () => {
		const ext = vscode.extensions.getExtension('jetbrains.qodana-code');
		await ext?.activate();
		const commands = await vscode.commands.getCommands(true);
		assert.ok(commands.includes('qodana.resetToken'));
		assert.ok(commands.includes('qodana.resetAllSettings'));
		assert.ok(commands.includes('qodana.openQodanaTab'));
		assert.ok(commands.includes('qodana.runLocally'));
		assert.ok(commands.includes('qodana.openLocalReport'));
		assert.ok(commands.includes('qodana.login'));
		assert.ok(commands.includes('qodana.refreshProjects'));
		assert.ok(commands.includes('qodana.link'));
		assert.ok(commands.includes('qodana.unlink'));
	});
});
