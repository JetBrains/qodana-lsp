import * as vscode from "vscode";
import {CONF_PROJ_ID} from "../config";
import {extensionInstance} from "../extension";
import {CloudProjectResponse} from "./api";
import {openReportByProjectId} from "../report";
import {Events} from "../events";

export class LinkService {
    private linkedProjectId: string | undefined;
    private isLinked: boolean = false;
    private readonly closeReport: () => void;
    private projectProperties: CloudProjectResponse | undefined;

    constructor(private context: vscode.ExtensionContext, closeReport: () => void) {
        this.closeReport = closeReport;
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
            this.unlinkProject();
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
        let projectProperties = await extensionInstance.auth?.getAuthorized()?.qodanaCloudUserApi((api) => {
            return api.getProjectProperties(projectId!);
        });
        if (!projectProperties) {
            return;
        }
        this.projectProperties = projectProperties;
        this.isLinked = true;
        vscode.commands.executeCommand("setContext", "qodana.linked", true);
        vscode.workspace.getConfiguration().update(CONF_PROJ_ID, this.linkedProjectId, vscode.ConfigurationTarget.Workspace);
        Events.instance.fireProjectLinked();
    }

    unlinkProject() {
        this.isLinked = false;
        this.projectProperties = undefined;
        vscode.commands.executeCommand("setContext", "qodana.linked", false);
        this.closeReport();
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
}