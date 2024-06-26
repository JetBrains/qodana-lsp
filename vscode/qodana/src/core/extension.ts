import * as vscode from 'vscode';

import {
    LanguageClient,
    State,
} from 'vscode-languageclient/node';

import { getLanguageClient } from './client';
import config, {WS_BASELINE_ISSUES} from './config';


import {
    onBaselineStatusChange,
    onConfigChange, onReportClosed,
    onReportFile,
    onReportOpened,
    onServerStateChange,
    onTimerCallback,
    onUrlCallback
} from './client/activities';
import { Auth } from './auth';
import { runQodana, showLocalReport } from './cli/executor';
import { getCli } from './cli/cliDownloader';
import { obtainToken } from './cli/token';
import { Events } from './events';
import { QodanaState } from './menuitems/QodanaState';
import { BaselineToggle } from './menuitems/BaselineToggle';
import { LinkService } from './cloud/link';
import {LocalRunsService} from './localRun';
import telemetry from './telemetry';

export class QodanaExtension {
    public languageClient?: LanguageClient;
    private context?: vscode.ExtensionContext;
    public auth?: Auth;
    private static _instance: QodanaExtension;
    private statusIcon: QodanaState = QodanaState.instance;
    private baselineFilterIcon: BaselineToggle = BaselineToggle.instance;
    public linkService?: LinkService;
    public localRunService?: LocalRunsService;

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
            throw new Error('Context is not set');
        }
        this.auth = await Auth.create(this.context);

        this.linkService = await LinkService.create(this.context);
        this.localRunService = new LocalRunsService(this.context);

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
        onReportOpened();
        onReportClosed();
        await this.languageClient.start();
    }

    async toggleBaseline() {
        Events.instance.fireBaselineChange();
    }

    async restartLanguageServer() {
        if (this.languageClient && this.languageClient.isRunning()) {
            await this.languageClient.stop().catch(() => {
                // ignore
            });
            // stop handler needs some pause, since otherwise it clashes with initializer
            await new Promise(resolve => setTimeout(resolve, 2000));
            await this.languageClient.start().catch(() => {
                // ignore
            });
        }
    }

    async stopLanguageServer() {
        if (this.languageClient && this.languageClient.isRunning()) {
            await this.languageClient.stop().catch(() => {
                // ignore
            });
            // stop handler needs some pause, since otherwise it clashes with initializer
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    async closeReport() {
        //todo refactor
        Events.instance.fireReportFile({
            reportFile: undefined,
            reportId: undefined
        });
        telemetry.reportClosed();
        await this.restartLanguageServer();
    }

    async toggleQodana() {
        if (this.languageClient) {
            if (this.languageClient.isRunning()) {
                await this.languageClient.stop().catch(() => {
                    // ignore
                });
            } else {
                if (this.languageClient.state === State.Stopped) {
                    await this.languageClient.start().catch(() => {
                        // ignore
                    });
                }
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
            if (token === undefined) {
                return;
            }
            let tempDir = await runQodana(cli, token);
            await this.closeReport();
            await showLocalReport(this.context, tempDir);
        }
    }

    getVersion(): string {
       return this.context?.extension.packageJSON.version;
    }
}

export const extensionInstance = QodanaExtension.instance;

