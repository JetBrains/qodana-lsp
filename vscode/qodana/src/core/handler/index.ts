import * as vscode from 'vscode';
import { UriHandler } from 'vscode';
import { FAILED_ID_NOT_PRESENT, FAILED_PATH_NOT_PRESENT, FAILED_PREFIX_NOT_SET, ID_CANCEL, ID_SET, idNotEqual, idNotSet } from '../messages';
import config from '../config';
import { join } from 'node:path';
import telemetry from '../telemetry';
import { extensionInstance } from '../extension';
import { State } from 'vscode-languageclient';


export class ShowMarkerHandler implements UriHandler {
    private readonly context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async projectIdNotSet(projectId: string, projectIdInSettings: unknown): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            if (projectId && !projectIdInSettings) {
                vscode.window.showErrorMessage(idNotSet(projectId), ID_SET, ID_CANCEL).then(async (value) => {
                    if (value === ID_SET) {
                        await vscode.workspace.getConfiguration().update('qodana.projectId', projectId, vscode.ConfigurationTarget.Workspace);
                    }
                    resolve(value === ID_SET);
                });
            } else if (projectId && projectIdInSettings !== projectId) {
                vscode.window.showErrorMessage(idNotEqual(projectId), ID_SET, ID_CANCEL).then(async (value) => {
                    if (value === ID_SET) {
                        await vscode.workspace.getConfiguration().update('qodana.projectId', projectId, vscode.ConfigurationTarget.Workspace);
                    }
                    resolve(value === ID_SET);
                });
            } else {
                resolve(true);
            }
        });
    }

    async handleUri(uri: vscode.Uri) {
        if (uri.path === '/showMarker') {
            let query = uri.query.split('&');
            let path = query.find((value) => {
                return value.startsWith('path=');
            });
            if (!path) {
                vscode.window.showErrorMessage(FAILED_PATH_NOT_PRESENT);
                telemetry.errorReceived('#handleUri no path');
                return;
            }
            let pathValue = decodeURIComponent(path?.split('=')[1]);
            let projectId = query.find((value) => {
                return value.startsWith('cloud_project_id=');
            });
            if (!projectId) {
                vscode.window.showErrorMessage(FAILED_ID_NOT_PRESENT);
                telemetry.errorReceived('#handleUri no projectId');
                return;
            }
            let reportId = query.find((value) => {
                return value.startsWith('cloud_report_id=');
            });
            if (reportId) {
                let reportIdValue = reportId.split('=')[1];
                // this value will be picked up by next report fetch
                // we set it here in advance if projectId was not previously set
                // so that it will be picked up afterwards
                await this.context.workspaceState.update('handlerReportId', reportIdValue);
            }
            let projectIdInSettings = vscode.workspace.getConfiguration().get('qodana.projectId');
            let projectIdValue = projectId.split('=')[1];
            let projectIdAccepted = await this.projectIdNotSet(projectIdValue, projectIdInSettings);
            if (!projectIdAccepted) {
                if (reportId) {
                    await this.context.workspaceState.update('handlerReportId', undefined);
                }
                return;
            }
            if (reportId && extensionInstance.languageClient?.state === State.Running) {
                extensionInstance.openFreshReport();
            }
            let pathValueParts = pathValue.split(':');
            if (pathValueParts.length === 3) {
                let filePath = pathValueParts[0];
                let line = pathValueParts[1];
                let column = pathValueParts[2];
                let pathPrefix = config.getAbsolutePrefix(this.context);
                if (pathPrefix) {
                    let length = query.find((value) => {
                        return value.startsWith('length=');
                    });
                    let lengthValue = length?.split('=')[1] || '1';
                    let settings = vscode.Uri.file(join(pathPrefix, filePath));
                    let doc = await vscode.workspace.openTextDocument(settings);
                    let editor = await vscode.window.showTextDocument(doc);
                    let startPosition = new vscode.Position(Number(line) - 1, Number(column) - 1);
                    let endPosition = new vscode.Position(Number(line) - 1, Number(column) - 1 + Number(lengthValue));
                    editor.selection = new vscode.Selection(startPosition, endPosition);
                    editor.revealRange(new vscode.Range(startPosition, endPosition), vscode.TextEditorRevealType.InCenter);
                    return;
                } else {
                    vscode.window.showErrorMessage(FAILED_PREFIX_NOT_SET);
                    telemetry.errorReceived('#handleUri no prefix');
                }
            }
        }
    }
}