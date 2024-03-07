import * as vscode from 'vscode';
import { UriHandler } from 'vscode';
import { FAILED_ID_NOT_PRESENT, FAILED_PATH_NOT_PRESENT, FAILED_PREFIX_NOT_SET, FAILED_REPORT_ID_NOT_PRESENT, ID_CANCEL, ID_SET, idNotEqual, idNotSet } from '../messages';
import config, {CONF_PROJ_ID} from '../config';
import { join } from 'node:path';
import telemetry from '../telemetry';
import { Events } from '../events';


export class ShowMarkerHandler implements UriHandler {
    private readonly context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async projectIdNotSet(projectId: string): Promise<boolean> {
        let projectIdInSettings = vscode.workspace.getConfiguration().get<string>(CONF_PROJ_ID);
        return new Promise<boolean>((resolve) => {
            if (projectId && !projectIdInSettings) {
                vscode.window.showErrorMessage(idNotSet(projectId), ID_SET, ID_CANCEL).then(async (value) => {
                    if (value === ID_SET) {
                        await vscode.workspace.getConfiguration().update(CONF_PROJ_ID, projectId, vscode.ConfigurationTarget.Workspace);
                    }
                    resolve(value === ID_SET);
                });
            } else if (projectId && projectIdInSettings !== projectId) {
                vscode.window.showErrorMessage(idNotEqual(projectId), ID_SET, ID_CANCEL).then(async (value) => {
                    if (value === ID_SET) {
                        await vscode.workspace.getConfiguration().update(CONF_PROJ_ID, projectId, vscode.ConfigurationTarget.Workspace);
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
            let uriPathArg = query.find((value) => {
                return value.startsWith('path=');
            });
            if (!uriPathArg) {
                vscode.window.showErrorMessage(FAILED_PATH_NOT_PRESENT);
                telemetry.errorReceived('#handleUri no path');
                return;
            }
            let uriPath = decodeURIComponent(uriPathArg?.split('=')[1]);
            let cloudProjectIdArg = query.find((value) => {
                return value.startsWith('cloud_project_id=');
            });
            if (!cloudProjectIdArg) {
                vscode.window.showErrorMessage(FAILED_ID_NOT_PRESENT);
                telemetry.errorReceived('#handleUri no projectId');
                return;
            }
            let cloudProjectId = cloudProjectIdArg.split('=')[1];
            let projectIdAccepted = await this.projectIdNotSet(cloudProjectId);
            if (!projectIdAccepted) {
                // user didn't accept this project id
                return;
            }
            let cloudReportIdArg = query.find((value) => {
                return value.startsWith('cloud_report_id=');
            });
            if (!cloudReportIdArg) {
                vscode.window.showErrorMessage(FAILED_REPORT_ID_NOT_PRESENT);
                telemetry.errorReceived('#handleUri no reportId');
                return;
            }
            let cloudReportId = cloudReportIdArg.split('=')[1];
            Events.instance.fireUrlCallback({ projectId: cloudProjectId, reportId: cloudReportId });
            let pathValueParts = uriPath.split(':');
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