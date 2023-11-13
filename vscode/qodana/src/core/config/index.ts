// return a handler that will accept extension context and will listen for the workspace settings change
import * as vscode from "vscode";
import { LanguageClient, State } from "vscode-languageclient/node";
import { PATH_PREFIX_NOT_SET, PROJECT_ID_NOT_SET, RELOAD, RELOAD_TO_APPLY, ULS_PROCEED, USER_LEVEL_SETTINGS } from "../messages";
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import telemetry from "../telemetry";

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
        { id: 'qodana.projectId', message: PROJECT_ID_NOT_SET, checker: async (value: unknown) => value !== '' },
        {
            id: 'qodana.pathPrefix', message: PATH_PREFIX_NOT_SET, checker: async (value: unknown) => {
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
        await context.workspaceState.update('openedreport', null);
        await context.workspaceState.update('reportId', null);
        await context.workspaceState.update('computedPrefix', null);
        await context.workspaceState.update('baselineIssues', false);
        // reset workspace settings
        await vscode.workspace.getConfiguration().update('qodana.projectId', undefined, vscode.ConfigurationTarget.Workspace);
        await vscode.workspace.getConfiguration().update('qodana.pathPrefix', undefined, vscode.ConfigurationTarget.Workspace);

        // reset global settings
        await vscode.workspace.getConfiguration().update('qodana.projectId', undefined, vscode.ConfigurationTarget.Global);
        await vscode.workspace.getConfiguration().update('qodana.pathPrefix', undefined, vscode.ConfigurationTarget.Global);
    }

    async resetGlobalSettings(): Promise<void> {
        // reset global settings
        await vscode.workspace.getConfiguration().update('qodana.projectId', undefined, vscode.ConfigurationTarget.Global);
        await vscode.workspace.getConfiguration().update('qodana.pathPrefix', undefined, vscode.ConfigurationTarget.Global);
    }

    getAbsolutePrefix(context: vscode.ExtensionContext): string {
        let pathPrefix = vscode.workspace.getConfiguration().get('qodana.pathPrefix') || '';
        let computedPrefix = context.workspaceState.get('computedPrefix') || ''; // absolute path
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
        if (isValid && client.state === State.Stopped) {
            await client.start();
        } else if (!isValid && client.state === State.Running) {
            await client.stop();
        } else if (isValid && client.state === State.Running) {
            await this.reloadWorkspace();
        }
    }

    private async reloadWorkspace() {
        let value = await vscode.window.showInformationMessage(RELOAD_TO_APPLY, RELOAD);
        if (value === RELOAD) {
            await vscode.commands.executeCommand("workbench.action.reloadWindow");
        }
    }
}

export default ConfigurationHelper.instance;