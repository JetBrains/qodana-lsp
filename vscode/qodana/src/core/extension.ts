import * as vscode from "vscode";

import {
    LanguageClient,
    State,
} from "vscode-languageclient/node";

import { getLanguageClient } from "./client";
import config, {WS_BASELINE_ISSUES} from "./config";


import { onBaselineStatusChange, onConfigChange, onReportFile, onServerStateChange, onTimerCallback, onUrlCallback } from "./client/activities";
import { Auth } from './auth';
import { runQodana, showLocalReport } from "./cli/executor";
import { getCli } from "./cli/cliDownloader";
import { obtainToken } from "./cli/token";
import { Events } from "./events";
import { QodanaState } from "./menuitems/QodanaState";
import { BaselineToggle } from "./menuitems/BaselineToggle";
import { ProjectsView } from "./ui/projectsView";
import { LinkService } from "./cloud/link";
import {openReportByProjectId} from "./report";
import {LocalRunsService} from "./localRun";

export class QodanaExtension {
    public languageClient?: LanguageClient;
    private context?: vscode.ExtensionContext;
    private auth?: Auth;
    private static _instance: QodanaExtension;
    private statusIcon: QodanaState = QodanaState.instance;
    private baselineFilterIcon: BaselineToggle = BaselineToggle.instance;
    private localRunService?: LocalRunsService;

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
        this.auth = await Auth.create(this.context);

        this.localRunService = new LocalRunsService(this.context);

        this.initProjectsView();
        this.initAuthMethods();
        this.initLinkService();


        this.languageClient = await getLanguageClient(this.context);
        this.languageClient.onDidChangeState(
            async (stateChangeEvent) => {
                Events.instance.fireServerStateChange(stateChangeEvent.newState);
            }
        );
        this.statusIcon.notAttachedToReport();
        this.baselineFilterIcon.toggle(this.context?.workspaceState.get(WS_BASELINE_ISSUES, false));

        if (!await config.configIsValid(this.context, true)) {
            this.statusIcon.settingsNotValid();
        }
        config.sectionChangeHandler(this.languageClient, this.context);
        onReportFile(this.languageClient, this.context);
        onServerStateChange(this.context);
        onBaselineStatusChange(this.languageClient, this.context);
        onConfigChange(this.languageClient, this.context);
        onTimerCallback(this.context, this.auth);
        onUrlCallback(this.context, this.auth);
        await this.languageClient.start();
    }

    initAuthMethods() {
        if (!this.context) {
            return;
        }
        this.context.subscriptions.push(
            vscode.commands.registerCommand('qodana.login', async () => {
                this.auth?.handleUnauthorizedState();
            })
        );
        this.context.subscriptions.push(
            vscode.commands.registerCommand('qodana.loginCustomServer', async () => {
                const userInput = await vscode.window.showInputBox({
                    prompt: "Input Qodana Self-Hosted Url"
                });
                if (userInput !== undefined) {
                    this.auth?.handleUnauthorizedState(userInput);
                }
                // todo handle error
            })
        );

        this.context.subscriptions.push(
            vscode.commands.registerCommand('qodana.logout', async () => {
                await this.closeReport();
                this.auth?.logOut();
            })
        );
        this.context.subscriptions.push(
            vscode.commands.registerCommand('qodana.cancel-authorization', async () => {
                this.auth?.cancelAuthorization();
            })
        );
    }

    initProjectsView() {
        if (!this.context) {
            return;
        }
        const projectsView = new ProjectsView(async () => {
            return this.auth?.getProjects();
        });
        this.context.subscriptions.push(vscode.window.createTreeView("qodana.link-view", {
            treeDataProvider: projectsView
        }));

        vscode.commands.registerCommand('qodanaLinkView.refresh', () => projectsView.refresh());
    }

    initLinkService() {
        const linkService = new LinkService(async () => {
            if (!this.context) {
                return;
            }
            await this.closeReport();
        });

        vscode.commands.registerCommand('qodanaLinkView.open-report', () => {
            let projectId = linkService.getLinkedProjectId();
            if (projectId === undefined || this.languageClient === undefined || this.auth === undefined || this.context === undefined) {
                return;
            }
            let authorized = this.auth.getAuthorized();
            if (authorized) {
                openReportByProjectId(projectId, this.context, authorized);
                vscode.commands.executeCommand("workbench.action.problems.focus");
            }
        });
    }

    async closeReport() {
        //todo refactor
        Events.instance.fireReportFile({
            reportFile: undefined,
            reportId: undefined
        });
        await this.languageClient?.sendRequest("closeReport");
    }

    async toggleBaseline() {
        Events.instance.fireBaselineChange();
    }

    async toggleQodana() {
        if (this.languageClient) {
            if (this.languageClient.state === State.Running) {
                await this.languageClient.stop(10).catch(() => {
                    // ignore
                });
            } else {
                await this.languageClient.start().catch(() => {
                    // ignore
                });
            }
        }
    };

    async resetToken() {
        if (this.languageClient && this.auth) {
            await this.auth.resetTokens();
        }
    }

    async resetAllSettings() {
        await config.resetSettings(this.context as vscode.ExtensionContext);
        await this.resetToken();
        this.statusIcon.settingsNotValid();
        Events.instance.fireBaselineChange();
    }

    async localRun() {
        let cli = await getCli(this.context as vscode.ExtensionContext);
        if (cli && this.context) {
            let token = await obtainToken(this.context as vscode.ExtensionContext);
            let tempDir = await runQodana(cli, token);
            await showLocalReport(this.context, tempDir);
        }
    }
}

export const extensionInstance = QodanaExtension.instance;

