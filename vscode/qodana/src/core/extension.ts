import * as vscode from "vscode";

import {
    LanguageClient,
    State,
} from "vscode-languageclient/node";

import { getLanguageClient } from "./client";
import config from "./config";


import { announceSarifFile } from "./client/activities";
import { Auth } from './auth';

export class QodanaExtension {
    public languageClient?: LanguageClient;
    private context?: vscode.ExtensionContext;
    private recurringTimer?: NodeJS.Timer;
    private statusBarItem?: vscode.StatusBarItem;
    private auth?: Auth;
    private warningBg = new vscode.ThemeColor('statusBarItem.warningBackground');
    private static _instance: QodanaExtension;

    private constructor() {
    }

    public static get instance(): QodanaExtension {
        if (!this._instance) {
            this._instance = new QodanaExtension();
        }
        return this._instance;
    }


    setContext(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async init(): Promise<void> {
        if (!this.context) {
            throw new Error("Context is not set");
        }
        this.auth = new Auth(this.context);

        this.languageClient = await getLanguageClient(this.context);
        this.languageClient.onDidChangeState(
            async (stateChangeEvent) => {
                if (stateChangeEvent.newState === State.Running && this.context && this.languageClient && this.auth) {
                    await this.context.workspaceState.update('openedreport', null);
                    this.recurringTimer = await announceSarifFile(this.languageClient, this.context, this.auth);
                    this.attachedToReport(this.context.workspaceState.get('reportId'));
                } else if (stateChangeEvent.newState === State.Stopped && this.context) {
                    this.recurringTimer && clearInterval(this.recurringTimer);
                    await this.context.workspaceState.update('openedreport', null);
                    this.notAttachedToReport();
                }
            }
        );


        // create icon in the status bar
        this.statusBarItem = this.createStatusBarItem();
        this.statusBarItem.show();
        this.notAttachedToReport();

        if (await config.configIsValid(this.context, true)) {
            await this.languageClient.start();
        } else {
            this.settingsNotValid();
        }
        config.sectionChangeHandler(this.languageClient, this.context);
    }

    private notAttachedToReport() {
        if (!this.statusBarItem) {
            return;
        }
        this.statusBarItem.text = '$(eye-closed) Qodana';
        this.statusBarItem.tooltip = 'Not attached to report';
        this.statusBarItem.command = 'qodana.toggleQodana';
        this.statusBarItem.backgroundColor = this.warningBg;
    }

    private settingsNotValid() {
        if (!this.statusBarItem) {
            return;
        }
        this.statusBarItem.text = '$(gear) Qodana';
        this.statusBarItem.tooltip = 'Settings are not valid';
        this.statusBarItem.command = 'qodana.openWorkspaceSettings';
        this.statusBarItem.backgroundColor = undefined;
    }

    private attachedToReport(reportId: string | undefined) {
        if (!this.statusBarItem) {
            return;
        }
        this.statusBarItem.text = '$(eye) Qodana';
        this.statusBarItem.command = 'qodana.toggleQodana';
        this.statusBarItem.tooltip = 'Attached to report: ' + reportId;
        this.statusBarItem.backgroundColor = undefined;
    }

    private createStatusBarItem(): vscode.StatusBarItem {
        return vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    }

    async toggleQodana() {
        if (this.languageClient) {
            if (this.languageClient.state === State.Running) {
                await this.languageClient.stop().catch(() => {
                    // ignore
                });
            } else if (await config.configIsValid(this.context as vscode.ExtensionContext, false)) {
                await this.languageClient.start().catch(() => {
                    // ignore
                });
            }
        }
    };

    async resetToken() {
        if (this.languageClient && this.auth) {
            if (this.languageClient.state === State.Running) {
                await this.languageClient.stop().catch(() => {
                    // ignore
                });
                await this.auth.resetTokens();
                await this.languageClient.start();
            } else {
                await this.auth.resetTokens();
            }
        }
    }

    async resetAllSettings() {
        await config.resetSettings(this.context as vscode.ExtensionContext);
        await this.resetToken();
        this.settingsNotValid();
    }
}

export const extensionInstance = QodanaExtension.instance;

