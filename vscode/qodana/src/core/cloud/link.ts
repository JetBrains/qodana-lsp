import * as vscode from "vscode";
import {CONF_PROJ_ID, STATE_LINKED} from "../config";
import {extensionInstance} from "../extension";
import {CloudProjectResponse} from "./api";
import {openReportByProjectId} from "../report";
import {Events} from "../events";
import telemetry from "../telemetry";

export class LinkService {
    private linkedProjectId: string | undefined;
    private isLinked: boolean = false;
    private projectProperties: CloudProjectResponse | undefined;

    constructor(private context: vscode.ExtensionContext) {
        vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration('qodana')) {
                await this.selectAndLink();
            }
        });
        this.selectAndLink();
    }

    private async selectAndLink() {
        let projectId = vscode.workspace.getConfiguration().get<string>(CONF_PROJ_ID);
        if (projectId) {
            this.selectProject(projectId);
            await this.linkProject();
        } else {
            await this.unlinkProject();
        }
    }

    selectProject(projectId: string) {
        this.linkedProjectId = projectId;
    }

    async linkProject() {
        let projectId = this.linkedProjectId;
        if (projectId === undefined) {
            return;
        }
        let projectProperties = await this.getProjectProperties(projectId);
        if (!projectProperties) {
            return;
        }
        this.projectProperties = projectProperties;
        this.isLinked = true;
        vscode.workspace.getConfiguration().update(CONF_PROJ_ID, this.linkedProjectId, vscode.ConfigurationTarget.Workspace);
        vscode.commands.executeCommand('setContext', STATE_LINKED, true);
        telemetry.projectLinked();
        Events.instance.fireProjectLinked();
    }

    async unlinkProject() {
        this.isLinked = false;
        this.projectProperties = undefined;
        vscode.workspace.getConfiguration().update(CONF_PROJ_ID, undefined, vscode.ConfigurationTarget.Workspace);
        vscode.commands.executeCommand('setContext', STATE_LINKED, false);
        telemetry.projectUnlinked();
        await extensionInstance.closeReport();
    }

    getLinkedProjectId(): string | undefined {
        if (this.isLinked) {
            return this.linkedProjectId;
        }
        return undefined;
    }

    getLinkedProjectName(): string | undefined {
        return this.projectProperties?.name;
    }

    async openReport() {
        let projectId = this?.getLinkedProjectId();
        if (projectId === undefined || extensionInstance.languageClient === undefined || extensionInstance.auth === undefined || this.context === undefined) {
            return;
        }
        let authorized = extensionInstance.auth.getAuthorized();
        if (authorized) {
            await openReportByProjectId(projectId, this.context, authorized);
            vscode.commands.executeCommand("workbench.action.problems.focus");
        }
    }

    async getProjectProperties(projectId?: string, withError: boolean = true) {
        let id = projectId ? projectId : this.linkedProjectId;
        if (!id) {
            return undefined;
        }
        let projectProperties = await extensionInstance.auth?.getAuthorized()?.qodanaCloudUserApi((api) => {
            return api.getProjectProperties(id!, withError);
        });
        if (!projectProperties) {
            await this.unlinkProject();
        }
        return projectProperties;
    }
}