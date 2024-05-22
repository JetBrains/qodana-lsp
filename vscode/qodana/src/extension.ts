// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { extensionInstance } from './core/extension';
import { ShowMarkerHandler } from './core/handler';
import telemetry from './core/telemetry';
import {OtherTreeItem, ProjectsView} from "./core/ui/projectsView";
import {LinkedView} from "./core/ui/linkedView";
import {LogInView} from "./core/ui/loginView";
import {SettingsView} from "./core/ui/settingsView";
import {
	COMMAND_CANCEL_AUTHORIZATION,
	COMMAND_CLOSE_REPORT,
	COMMAND_LINK,
	COMMAND_LOG_IN,
	COMMAND_LOG_IN_CUSTOM_SERVER,
	COMMAND_LOG_OUT,
	COMMAND_OPEN_LOCAL_REPORT,
	COMMAND_REFRESH_PROJECTS,
	COMMAND_RUN_LOCALLY,
	COMMAND_SELECT_NODE,
	COMMAND_UNLINK, LOCAL_REPORT, WS_REPORT_ID
} from "./core/config";
import {OTHER_PROJECT_TOOLTIP, SELF_HOSTED_TOOLTIP} from "./core/messages";
import {RunLocallyView} from "./core/ui/runLocallyView";

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
	context.subscriptions.push(vscode.commands.registerCommand(COMMAND_RUN_LOCALLY, async () => {
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
		vscode.commands.registerCommand(COMMAND_REFRESH_PROJECTS, () => projectsView.refresh())
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('qodanaTreeItem.other-item', async (otherItem: OtherTreeItem) => {
			const userInput = await vscode.window.showInputBox({
				prompt: OTHER_PROJECT_TOOLTIP,
			});
			if (userInput !== undefined) {
				otherItem.label = "Other project: " + userInput;
				otherItem.projectId = userInput;
				projectsView.refreshItem(otherItem);
			}
			vscode.commands.executeCommand(COMMAND_SELECT_NODE, otherItem.projectId);
		})
	);
}

function initAuthMethods(context: vscode.ExtensionContext) {
	if (!context) {
		return;
	}
	context.subscriptions.push(
		vscode.commands.registerCommand(COMMAND_LOG_IN, async () => {
			extensionInstance.auth?.logIn();
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand(COMMAND_LOG_IN_CUSTOM_SERVER, async () => {
			const userInput = await vscode.window.showInputBox({
				prompt: SELF_HOSTED_TOOLTIP
			});
			if (userInput !== undefined) {
				extensionInstance.auth?.logIn(userInput);
			}
			// todo handle error
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(COMMAND_LOG_OUT, () => {
			extensionInstance.closeReport().then();
			extensionInstance.auth?.logOut();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand(COMMAND_CANCEL_AUTHORIZATION, async () => {
			extensionInstance.auth?.cancelAuthorization();
		})
	);

	const loginView = new LogInView(context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(LogInView.viewType, loginView)
	);


	const settingsView = new SettingsView(context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(SettingsView.viewType, settingsView)
	);
}

function initLinkService(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand(COMMAND_SELECT_NODE, (id) => extensionInstance.linkService?.selectProject(id))
	);
	context.subscriptions.push(
		vscode.commands.registerCommand(COMMAND_LINK, async () => await extensionInstance.linkService?.linkProject())
	);
	context.subscriptions.push(
		vscode.commands.registerCommand(COMMAND_UNLINK, async () => {
			await extensionInstance.linkService?.unlinkProject();
		})
	);
	const linkedView = new LinkedView(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(LinkedView.viewType, linkedView)
	);
}

function initLocalRunService(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand(COMMAND_OPEN_LOCAL_REPORT, async () => {
			extensionInstance.localRunService?.openLocalReportAction();
		})
	);
	context.subscriptions.push(
		vscode.commands.registerCommand(COMMAND_CLOSE_REPORT, async () => {
			let isLocal = await context.workspaceState.get(WS_REPORT_ID) === LOCAL_REPORT;
			if (isLocal) {
				await extensionInstance.closeReport();
			} else {
				await extensionInstance.linkService?.unlinkProject();
			}
		})
	);
	const runLocallyView = new RunLocallyView(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(RunLocallyView.viewType, runLocallyView)
	);
}

// This method is called when your extension is deactivated
export async function deactivate() {
	await extensionInstance.stopLanguageServer();
}
