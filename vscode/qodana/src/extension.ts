// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { extensionInstance } from './core/extension';
import { ShowMarkerHandler } from './core/handler';
import telemetry from './core/telemetry';
import {ProjectsView} from "./core/ui/projectsView";
import {openReportByProjectId} from "./core/report";

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

	initProjectsView(context);
	initAuthMethods(context);
	initLinkService(context);
	initLocalRunService(context);

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

	// add command to run qodana locally
	context.subscriptions.push(vscode.commands.registerCommand('qodana.runLocally', async () => {
		if (!extensionInstance) {
			return;
		}
		telemetry.localRunRequested();
		await extensionInstance.localRun();
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
function initProjectsView(context: vscode.ExtensionContext) {
	if (!context) {
		return;
	}
	const projectsView = new ProjectsView(async () => {
		return extensionInstance.auth?.getProjects();
	});
	context.subscriptions.push(vscode.window.createTreeView("qodana.link-view", {
		treeDataProvider: projectsView
	}));

	context.subscriptions.push(
		vscode.commands.registerCommand('qodanaLinkView.refresh', () => projectsView.refresh())
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('qodanaTreeItem.other-item', async (otherItem: vscode.TreeItem) => {
			const userInput = await vscode.window.showInputBox({
				prompt: "Input Qodana Project ID",
			});
			if (userInput !== undefined) {
				// todo handle error
				otherItem.label = "Other project: " + userInput;
				projectsView.refreshItem(otherItem);
				vscode.commands.executeCommand("qodanaLinkView.selectNode", userInput);
			}
		})
	);
}

function initAuthMethods(context: vscode.ExtensionContext) {
	if (!context) {
		return;
	}
	context.subscriptions.push(
		vscode.commands.registerCommand('qodana.login', async () => {
			extensionInstance.auth?.handleUnauthorizedState();
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('qodana.loginCustomServer', async () => {
			const userInput = await vscode.window.showInputBox({
				prompt: "Input Qodana Self-Hosted Url"
			});
			if (userInput !== undefined) {
				extensionInstance.auth?.handleUnauthorizedState(userInput);
			}
			// todo handle error
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('qodana.logout', async () => {
			await extensionInstance.closeReport();
			extensionInstance.auth?.logOut();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('qodana.cancel-authorization', async () => {
			extensionInstance.auth?.cancelAuthorization();
		})
	);
}

function initLinkService(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand('qodanaLinkView.open-report', () => {
			let projectId = extensionInstance.linkService?.getLinkedProjectId();
			if (projectId === undefined || extensionInstance.languageClient === undefined || extensionInstance.auth === undefined || context === undefined) {
				return;
			}
			let authorized = extensionInstance.auth.getAuthorized();
			if (authorized) {
				openReportByProjectId(projectId, context, authorized);
				vscode.commands.executeCommand("workbench.action.problems.focus");
			}
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('qodanaLinkView.selectNode', (id) => extensionInstance.linkService?.selectProject(id))
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('qodanaLinkView.link', () => extensionInstance.linkService?.linkProject())
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('qodanaLinkView.unlink', async () => {
			extensionInstance.linkService?.unlinkProject();
			await extensionInstance.closeReport();
		})
	);
}

function initLocalRunService(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand("qodana.openLocalReport", async () => {
			await extensionInstance.closeReport();
			extensionInstance.localRunService?.openLocalReportAction();
		})
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
