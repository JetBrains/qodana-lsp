import { LanguageClient, State } from "vscode-languageclient/node";
import * as vscode from "vscode";

import { Auth } from "../auth";
import { openReportById, openReportByProjectId } from "../report";
import { CLOUD_REPORT_LOADED, SHOW_PROBLEMS } from "../messages";
import config, {
    CONF_PROJ_ID, IS_DEBUG,
    WS_BASELINE_ISSUES,
    WS_COMPUTED_PREFIX,
    WS_OPENED_REPORT,
    WS_REPORT_ID
} from "../config";
import sarif from "../sarif";
import telemetry from "../telemetry";
import { Events, ReportFileEvent, UrlCallbackEvent } from "../events";
import { BaselineToggle } from "../menuitems/BaselineToggle";
import { QodanaState } from "../menuitems/QodanaState";

export function onUrlCallback(context: vscode.ExtensionContext, auth: Auth) {
    Events.instance.onUrlCallback(async (event: UrlCallbackEvent) => {
        let authorized = auth.getAuthorized();
        if (authorized) {
            await openReportById(event.projectId, event.reportId, context, authorized);
        } else {
            telemetry.errorReceived('#onUrlCallback exception');
        }
    });
}

export function onTimerCallback(context: vscode.ExtensionContext, auth: Auth) {
    Events.instance.onTimer(async () => {
        let projectId = vscode.workspace.getConfiguration().get<string>(CONF_PROJ_ID);
        if (projectId) {
            let authorized = auth.getAuthorized();
            if (authorized) {
                await openReportByProjectId(projectId, context, authorized);
            } else {
                telemetry.errorReceived('#onTimerCallback exception');
            }
        }
    });
}

export function onConfigChange(client: LanguageClient, context: vscode.ExtensionContext) {
    Events.instance.onServerStateChange((state: State) => {
        if (state === State.Running) {
            Events.instance.fireConfigChange(); // to trigger subscription to timer
        } else {
            Events.instance.stopTimer();
        }
    });
    Events.instance.onConfigChange(async () => {
        let clientIsRunning = client.state === State.Running;
        let isValid = await config.configIsValid(context, true);
        if (clientIsRunning && isValid) {
            Events.instance.startTimer(5 * 60 * 1000);
        } else {
            Events.instance.stopTimer();
        }
    });
}

export function onBaselineStatusChange(client: LanguageClient, context: vscode.ExtensionContext) {
    Events.instance.onBaselineChange(async () => {
        let value = !context.workspaceState.get(WS_BASELINE_ISSUES, false);
        await context.workspaceState.update(WS_BASELINE_ISSUES, value);
        BaselineToggle.instance.toggle(value);
        let reportPath = context.workspaceState.get<string>(WS_OPENED_REPORT);
        if (client.state === State.Running && reportPath) {
            await sendReportToLanguageClient(client, context, reportPath);
        }
    });
}

export function onServerStateChange(context: vscode.ExtensionContext) {
    Events.instance.onServerStateChange((state: State) => {
        if (state === State.Running) {
            let reportId = context.workspaceState.get<string>(WS_REPORT_ID);
            let reportPath = context.workspaceState.get<string>(WS_OPENED_REPORT);
            Events.instance.fireReportFile({ reportFile: reportPath, reportId: reportId });
        }
    });
}

export function onReportFile(client: LanguageClient, context: vscode.ExtensionContext) {
    Events.instance.onReportFile(async (event: ReportFileEvent) => {
        await context.workspaceState.update(WS_REPORT_ID, event.reportId);
        await context.workspaceState.update(WS_OPENED_REPORT, event.reportFile);
        if (client.state === State.Running && event.reportFile) {
            telemetry.reportOpened();
            await sendReportToLanguageClient(client, context, event.reportFile);
            QodanaState.instance.attachedToReport(event.reportId);
            Events.instance.fireReportOpened();
        } else {
            QodanaState.instance.notAttachedToReport();
            Events.instance.fireReportClosed();
        }
    });
}

export async function announceWorkspaceFolder(client: LanguageClient, context: vscode.ExtensionContext) {
    let locationParams: SetSourceLocationParams = {
        path: config.getAbsolutePrefix(context)
    };
    await client.sendRequest("setSourceLocation", locationParams);
}

export async function sendReportToLanguageClient(client: LanguageClient, context: vscode.ExtensionContext, reportPath: string) {
    if (!context.workspaceState.get(WS_COMPUTED_PREFIX)) {
        let computed = await sarif.findPrefix(reportPath);
        if (computed) {
            await context.workspaceState.update(WS_COMPUTED_PREFIX, computed);
        }
    }
    await announceWorkspaceFolder(client, context);
    let sarifParams: SetSarifFileParams = {
        path: reportPath,
        showBaselineIssues: context.workspaceState.get<boolean>(WS_BASELINE_ISSUES, false)
    };
    await client.sendRequest("setSarifFile", sarifParams);
    if (IS_DEBUG) {
        vscode.window.showInformationMessage(CLOUD_REPORT_LOADED, SHOW_PROBLEMS).then((value) => {
            if (value === SHOW_PROBLEMS) {
                vscode.commands.executeCommand("workbench.action.problems.focus");
            }
        });
    }
}

export function onReportClosed() {
    Events.instance.onReportClosed(() => {
        vscode.commands.executeCommand("setContext", "qodana.report-opened", false);
    });
}
export function onReportOpened() {
    Events.instance.onReportOpened(() => {
        vscode.commands.executeCommand("setContext", "qodana.report-opened", true);
    });
}

export interface SetSourceLocationParams {
    path: string;
}

export interface SetSarifFileParams {
    path: string;
    showBaselineIssues: boolean;
}