import { LanguageClient } from "vscode-languageclient/node";
import * as vscode from "vscode";

import { Auth } from "../auth";
import { getReportFile } from "../report";
import { CLOUD_REPORT_LOADED, NEW_REPORT_AVAILABLE, NO, SHOW_PROBLEMS, YES } from "../messages";
import config from "../config";
import sarif from "../sarif";
import telemetry from "../telemetry";

async function announceWorkspaceFolder(client: LanguageClient, context: vscode.ExtensionContext) {
    let locationParams: SetSourceLocationParams = {
        path: config.getAbsolutePrefix(context)
    };
    await client.sendRequest("setSourceLocation", locationParams);
}

export async function announceSarifFile(client: LanguageClient, context: vscode.ExtensionContext, auth: Auth): Promise<NodeJS.Timer> {
    await sarifAnnouncer(client, context, auth);
    return setInterval(async () => {
        await sarifAnnouncer(client, context, auth);
    }, 5 * 60 * 1000);
}

async function sarifAnnouncer(client: LanguageClient, context: vscode.ExtensionContext, auth: Auth) {
    let token = await auth.getTokenToCloud();
    if (token) {
        let reportPath = await getReportFile(context, token);
        let openedReport = await context.workspaceState.get('openedreport');
        if (reportPath && openedReport !== reportPath) {
            if (openedReport) {
                let answer = await vscode.window.showInformationMessage(NEW_REPORT_AVAILABLE, YES, NO);
                if (answer !== YES) {
                    return;
                }
            }
            telemetry.reportOpened();
            if (!context.workspaceState.get('computedPrefix')) {
                let computed = await sarif.findPrefix(reportPath);
                if (computed) {
                    await context.workspaceState.update('computedPrefix', computed);
                }
            }
            await announceWorkspaceFolder(client, context);
            let sarifParams: SetSarifFileParams = {
                path: reportPath
            };
            await client.sendRequest("setSarifFile", sarifParams);
            await context.workspaceState.update('openedreport', reportPath);
            vscode.window.showInformationMessage(CLOUD_REPORT_LOADED, SHOW_PROBLEMS).then((value) => {
                if (value === SHOW_PROBLEMS) {
                    vscode.commands.executeCommand("workbench.action.problems.focus");
                }
            });
        }
    } else {
        telemetry.errorReceived('#sarifAnnouncer exception');
        throw new Error(`Failed to obtain the token for Qodana Cloud`);
    }
}

export interface SetSourceLocationParams {
    path: string;
}

export interface SetSarifFileParams {
    path: string;
}