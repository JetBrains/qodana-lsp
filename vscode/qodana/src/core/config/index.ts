// return a handler that will accept extension context and will listen for the workspace settings change
import * as vscode from "vscode";
import { LanguageClient, State } from "vscode-languageclient/node";
import { PATH_PREFIX_NOT_SET, PROJECT_ID_NOT_SET, RELOAD, RELOAD_TO_APPLY, ULS_PROCEED, USER_LEVEL_SETTINGS } from "../messages";
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import telemetry from "../telemetry";
import { Events } from "../events";


export const IS_DEBUG = process.env.EXTENSION_DEBUG === 'true';

export const LOCAL_REPORT = 'LOCAL';
export const WS_BASELINE_ISSUES = 'baselineIssues';
export const WS_REPORT_ID = 'reportId';
export const WS_OPENED_REPORT = 'openedReport';
export const WS_COMPUTED_PREFIX = 'computedPrefix';
export const GS_CLI_SETTING = 'cliExecutablePath';
export const GS_JAVA_EXECUTABLE_PATH = 'javaExecutablePath';
export const CONF_PROJ_ID = 'qodana.projectId';
export const CONF_PATH_PREFIX = 'qodana.pathPrefix';
export const SERVER = 'qodana.server';
export const USER_ID = 'qodana.userId';
export const USER_FULL_NAME = 'qodana.userFullName';
export const USER_NAME = 'qodana.userName';

export const STATE_SIGNED_IN = 'qodana.signed-in';
export const STATE_AUTHORIZING = 'qodana.authorizing';
export const STATE_LINKED = 'qodana.linked';

export const COMMAND_LOG_IN = 'qodana.login';
export const COMMAND_LOG_IN_CUSTOM_SERVER = 'qodana.loginCustomServer';
export const COMMAND_LOG_OUT = 'qodana.logout';
export const COMMAND_CANCEL_AUTHORIZATION = 'qodana.cancel-authorization';
export const COMMAND_RUN_LOCALLY = 'qodana.runLocally';
export const COMMAND_OPEN_LOCAL_REPORT = 'qodana.openLocalReport';
export const COMMAND_CLOSE_REPORT = 'qodana.closeReport';
export const COMMAND_LINK = 'qodana.link';
export const COMMAND_UNLINK = 'qodana.unlink';
export const COMMAND_SELECT_NODE = 'qodana.selectNode';
export const COMMAND_REFRESH_PROJECTS = 'qodana.refreshProjects';

export const COMMANDS = new Set ([
    COMMAND_LOG_IN, COMMAND_LOG_IN_CUSTOM_SERVER, COMMAND_LOG_OUT, COMMAND_CANCEL_AUTHORIZATION, COMMAND_RUN_LOCALLY,
    COMMAND_OPEN_LOCAL_REPORT, COMMAND_CLOSE_REPORT, COMMAND_LINK, COMMAND_UNLINK, COMMAND_SELECT_NODE
]);

class ConfigurationHelper {
    private static _instance: ConfigurationHelper;
    private constructor() { }

    public static get instance(): ConfigurationHelper {
        if (!this._instance) {
            this._instance = new ConfigurationHelper();
        }
        return this._instance;
    }

    private settings = [
        { id: CONF_PROJ_ID, message: PROJECT_ID_NOT_SET, checker: async (value: unknown) => {
                if (IS_DEBUG) {
                    return value !== '';
                } else {
                    return true;
                }
            }
        },
        {
            id: CONF_PATH_PREFIX, message: PATH_PREFIX_NOT_SET, checker: async (value: unknown) => {
                if (!value) { return true; }
                try {
                    await fs.access(this.computeAbsolutePath(value as string));
                    return true;
                } catch (e) {
                    return false;
                }
            }
        }
    ];

    async resetSettings(context: vscode.ExtensionContext): Promise<void> {
        await context.workspaceState.update(WS_OPENED_REPORT, null);
        await context.workspaceState.update(WS_REPORT_ID, null);
        await context.workspaceState.update(WS_COMPUTED_PREFIX, null);
        await context.workspaceState.update(WS_BASELINE_ISSUES, false);
        await context.globalState.update(GS_JAVA_EXECUTABLE_PATH, null);
        await context.globalState.update(GS_CLI_SETTING, null);
        // reset workspace settings
        await vscode.workspace.getConfiguration().update(CONF_PROJ_ID, undefined, vscode.ConfigurationTarget.Workspace);
        await vscode.workspace.getConfiguration().update(CONF_PATH_PREFIX, undefined, vscode.ConfigurationTarget.Workspace);

        // reset global settings
        await vscode.workspace.getConfiguration().update(CONF_PROJ_ID, undefined, vscode.ConfigurationTarget.Global);
        await vscode.workspace.getConfiguration().update(CONF_PATH_PREFIX, undefined, vscode.ConfigurationTarget.Global);
    }

    async resetGlobalSettings(): Promise<void> {
        // reset global settings
        await vscode.workspace.getConfiguration().update(CONF_PROJ_ID, undefined, vscode.ConfigurationTarget.Global);
        await vscode.workspace.getConfiguration().update(CONF_PATH_PREFIX, undefined, vscode.ConfigurationTarget.Global);
    }

    getAbsolutePrefix(context: vscode.ExtensionContext): string {
        let pathPrefix = vscode.workspace.getConfiguration().get(CONF_PATH_PREFIX) || '';
        let computedPrefix = context.workspaceState.get(WS_COMPUTED_PREFIX) || ''; // absolute path
        if (pathPrefix === '' && computedPrefix !== '') {
            return computedPrefix as string;
        }
        return this.computeAbsolutePath(pathPrefix as string);
    }

    private computeAbsolutePath(pathPrefix: string): string {
        let workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            telemetry.errorReceived('#computeAbsolutePath');
            throw new Error("No workspace folders found");
        }

        let workspaceRoot = workspaceFolders[0].uri.fsPath;
        return pathPrefix.trim() === '' ? workspaceRoot : join(workspaceRoot, pathPrefix);
    }

    async configIsValid(context: vscode.ExtensionContext, silent: boolean): Promise<boolean> {
        let result = true;

        for (let setting of this.settings) {
            let value = vscode.workspace.getConfiguration().get(setting.id);
            if (!(await setting.checker(value))) {
                if (!silent) {
                    vscode.window.showInformationMessage(setting.message);
                }
                result = false;
            }
        }

        return result;
    }

    sectionChangeHandler(client: LanguageClient, context: vscode.ExtensionContext) {
        return vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration('qodana')) {
                await this.sectionChanged(client, context);
            }
        });
    }

    async sectionChanged(client: LanguageClient, context: vscode.ExtensionContext) {
        for (let setting of this.settings) {
            let allValues = vscode.workspace.getConfiguration().inspect(setting.id);
            if (allValues?.globalValue !== undefined && allValues.globalValue !== '') {
                let value = await vscode.window.showErrorMessage(USER_LEVEL_SETTINGS, ULS_PROCEED);
                if (value === ULS_PROCEED) {
                    await this.resetGlobalSettings();
                }
                return;
            }
        }

        // ok, it's not a global settings change, check if workspace settings are valid
        let isValid = await this.configIsValid(context, false);
        await this.updateClientState(isValid, client);
    }

    private async updateClientState(isValid: boolean, client: LanguageClient) {
        if (isValid && client.state === State.Running) {
            Events.instance.fireConfigChange();
            await this.reloadWorkspace();
        }
    }

    private async reloadWorkspace() {
        if (IS_DEBUG) {
            let value = await vscode.window.showInformationMessage(RELOAD_TO_APPLY, RELOAD);
            if (value === RELOAD) {
                await vscode.commands.executeCommand("workbench.action.reloadWindow");
            }
        }
    }
}

export default ConfigurationHelper.instance;