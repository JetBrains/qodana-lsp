import * as vscode from "vscode";

import {
    LanguageClient,
    State,
} from "vscode-languageclient/node";

import { getLanguageClient } from "./client";
import config from "./config";


import { SetSarifFileParams, announceSarifFile, openReportOnce } from "./client/activities";
import { Auth } from './auth';

export class QodanaExtension {
    public languageClient?: LanguageClient;
    private context?: vscode.ExtensionContext;
    private recurringTimer?: NodeJS.Timer;
    private qodanaStateBarItem?: vscode.StatusBarItem;
    private baselineTogglerBarItem?: vscode.StatusBarItem;
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
        this.qodanaStateBarItem = this.createQodanaStateBarItem();
        this.qodanaStateBarItem.show();
        this.notAttachedToReport();

        // create baseline toggler in the status bar
        this.baselineTogglerBarItem = this.createBaselineTogglerBarItem();
        this.baselineTogglerBarItem.show();
        this.applyBaselineTogglerBarItemStatus();

        if (await config.configIsValid(this.context, true)) {
            await this.languageClient.start();
        } else {
            this.settingsNotValid();
        }
        config.sectionChangeHandler(this.languageClient, this.context);
    }

    private notAttachedToReport() {
        if (!this.qodanaStateBarItem) {
            return;
        }
        this.qodanaStateBarItem.text = '$(eye-closed) Qodana';
        this.qodanaStateBarItem.tooltip = 'Not attached to report';
        this.qodanaStateBarItem.command = 'qodana.toggleQodana';
        this.qodanaStateBarItem.backgroundColor = this.warningBg;
    }

    private settingsNotValid() {
        if (!this.qodanaStateBarItem) {
            return;
        }
        this.qodanaStateBarItem.text = '$(gear) Qodana';
        this.qodanaStateBarItem.tooltip = 'Settings are not valid';
        this.qodanaStateBarItem.command = 'qodana.openWorkspaceSettings';
        this.qodanaStateBarItem.backgroundColor = undefined;
    }

    private attachedToReport(reportId: string | undefined) {
        if (!this.qodanaStateBarItem) {
            return;
        }
        this.qodanaStateBarItem.text = '$(eye) Qodana';
        this.qodanaStateBarItem.command = 'qodana.toggleQodana';
        this.qodanaStateBarItem.tooltip = 'Attached to report: ' + reportId;
        this.qodanaStateBarItem.backgroundColor = undefined;
    }

    private createQodanaStateBarItem(): vscode.StatusBarItem {
        return vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    }

    private createBaselineTogglerBarItem(): vscode.StatusBarItem {
        return vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    }

    private applyBaselineTogglerBarItemStatus() {
        if (!this.baselineTogglerBarItem) {
            return;
        }
        let showBaselineIssues = this.context?.workspaceState.get('baselineIssues', false);
        if (showBaselineIssues) {
            this.baselineTogglerBarItem.text = '$(filter-filled) All issues';
            this.baselineTogglerBarItem.tooltip = '[Qodana] Baseline issues are shown';
        } else {
            this.baselineTogglerBarItem.text = '$(filter) New issues';
            this.baselineTogglerBarItem.tooltip = '[Qodana] Baseline issues are hidden';
        }
        this.baselineTogglerBarItem.command = 'qodana.toggleBaseline';
    }

    async toggleBaseline() {
        if (!this.context) {
            return;
        }
        await this.context.workspaceState.update('baselineIssues', !this.context.workspaceState.get('baselineIssues', false));
        this.applyBaselineTogglerBarItemStatus();
        if (this.languageClient) {
            if (this.languageClient.state === State.Running) {
                let reportPath = this.context.workspaceState.get<string | undefined>('openedreport', undefined);
                if (!reportPath) {
                    return;
                }
                let sarifParams: SetSarifFileParams = {
                    path: reportPath,
                    showBaselineIssues: this.context.workspaceState.get('baselineIssues', false)
                };
                await this.languageClient.sendRequest("setSarifFile", sarifParams);
            }
        }
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
            } else {
                await this.auth.resetTokens();
            }
        }
    }

    async resetAllSettings() {
        await config.resetSettings(this.context as vscode.ExtensionContext);
        await this.resetToken();
        this.settingsNotValid();
        this.applyBaselineTogglerBarItemStatus();
    }

    openFreshReport() {
        openReportOnce(this.languageClient as LanguageClient, this.context as vscode.ExtensionContext, this.auth as Auth);
    }
}

export const extensionInstance = QodanaExtension.instance;

