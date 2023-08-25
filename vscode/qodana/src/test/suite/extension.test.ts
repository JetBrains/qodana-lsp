import * as assert from 'assert';

import * as vscode from 'vscode';

describe('Extension Test Suite', () => {
	it('Extension should be present', () => {
		assert.ok(vscode.extensions.getExtension('jetbrains.qodana'));
	});

	it('Extension registered commands should be present', () => {
		assert.ok(vscode.commands.getCommands(true).then((commands) => {
			return commands.includes('qodana.resetToken')
				&& commands.includes('qodana.resetAllSettings')
				&& commands.includes('qodana.toggleQodana');
		}));
	});
});
