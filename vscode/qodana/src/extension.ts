// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { extensionInstance } from './core/extension';
import { ShowMarkerHandler } from './core/handler';
import telemetry from './core/telemetry';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	//Set the context of the extension instance
	extensionInstance.setContext(context);
	// Start telemetry and subscribe to the context
	telemetry.extensionStarted(context);
	//Initialize the LS Client extension instance.
	await extensionInstance.init().catch((error)=> {
		console.log("Failed to activate Qodana SARIF extension. " + (error));
		telemetry.errorReceived('#activate exception');
	});

	// add command to reset the state of language server
	context.subscriptions.push(vscode.commands.registerCommand('qodana.resetToken', async () => {
		if (!extensionInstance) {
			return;
		}
		telemetry.authenticationResetted();
		await extensionInstance.resetToken();
	}));

	// add command to reset all settings
	context.subscriptions.push(vscode.commands.registerCommand('qodana.resetAllSettings', async () => {
		if (!extensionInstance) {
			return;
		}
		telemetry.settingsResetted();
		await extensionInstance.resetAllSettings();
	}));

	// internal toggle command
	context.subscriptions.push(vscode.commands.registerCommand('qodana.toggleQodana', async () => {
		if (!extensionInstance) {
			return;
		}
		telemetry.issuesToggled();
		await extensionInstance.toggleQodana();
	}));

	// baseline toggle command
	context.subscriptions.push(vscode.commands.registerCommand('qodana.toggleBaseline', async () => {
		if (!extensionInstance) {
			return;
		}
		telemetry.baselineToggled();
		await extensionInstance.toggleBaseline();
	}));

	// remove settings if the extension is uninstalled
	context.subscriptions.push(vscode.extensions.onDidChange(async () => {
		if (!extensionInstance) {
			return;
		}
		telemetry.extensionRemoved();
		if (!vscode.extensions.getExtension('jetbrains.qodana-code')) {
			await extensionInstance.resetAllSettings();
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('qodana.openWorkspaceSettings', async () => {
		vscode.commands.executeCommand('workbench.action.openWorkspaceSettings', '@ext:jetbrains.qodana-code');
	}));

	let handler = new ShowMarkerHandler(context);
	context.subscriptions.push(vscode.window.registerUriHandler( {
		handleUri: async (uri: vscode.Uri) => {
			telemetry.openedFromCloud();
			await handler.handleUri(uri);
		}
	}));
	return context;
}

// This method is called when your extension is deactivated
export function deactivate() {}
