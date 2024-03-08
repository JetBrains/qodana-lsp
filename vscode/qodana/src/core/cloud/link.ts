import * as vscode from "vscode";
import {CONF_PROJ_ID} from "../config";

export class LinkService {
    private likedProjectId: string | undefined;
    private isLinked: boolean = false;

    constructor() {
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('qodana')) {
                this.selectAndLink();
            }
        });
        this.selectAndLink();
    }

    private selectAndLink() {
        let projectId = vscode.workspace.getConfiguration().get<string>(CONF_PROJ_ID);
        if (projectId) {
            this.selectProject(projectId);
            this.linkProject();
        } else {
            this.unlinkProject();
        }
    }

    selectProject(projectId: string) {
        this.likedProjectId = projectId;
    }

    linkProject() {
        this.isLinked = true;
        vscode.commands.executeCommand("setContext", "qodana.linked", true);
        vscode.workspace.getConfiguration().update(CONF_PROJ_ID, this.likedProjectId, vscode.ConfigurationTarget.Workspace);
    }

    unlinkProject() {
        this.isLinked = false;
        vscode.commands.executeCommand("setContext", "qodana.linked", false);
        vscode.workspace.getConfiguration().update(CONF_PROJ_ID, undefined, vscode.ConfigurationTarget.Workspace);
    }

    getLinkedProjectId(): string | undefined {
        if (this.isLinked) {
            return this.likedProjectId;
        }
        return undefined;
    }
}