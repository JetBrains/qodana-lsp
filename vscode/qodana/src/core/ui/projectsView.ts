import * as vscode from 'vscode';
import {MatchingProject} from "../cloud/api";
import {COMMAND_SELECT_NODE} from "../config";
import {LAST_RUN, LINK_OTHER_PROJECT, OTHER_PROJECT, problemsCountString, SELECT_PROJECT} from "../messages";

export class ProjectsView implements vscode.TreeDataProvider<vscode.TreeItem> {
    protected _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    readonly getProjects: () => Promise<MatchingProject[] | undefined>;

    constructor(getProjects: () => Promise<MatchingProject[] | undefined>) {
        this.getProjects = getProjects;
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        let projects = await this.getProjects();
        let idToProject = new Map<string, MatchingProject>;
        projects?.forEach(project => {
            if (!idToProject.has(project.projectId)) {
                idToProject.set(project.projectId, project);
            }
        });
        //todo add sorting
        let projectsSet = [... new Set(idToProject.values())].sort();
        let projectItems: vscode.TreeItem[] = projectsSet.map((project => new LinkTreeItem(project)));

        const otherItem = new OtherTreeItem(OTHER_PROJECT);
        otherItem.command = {
            command: 'qodanaTreeItem.other-item',
            title: LINK_OTHER_PROJECT,
            arguments: [otherItem]
        };
        projectItems.push(otherItem);
        return projectItems;
    }

    async getTreeItem(element: vscode.TreeItem): Promise<vscode.TreeItem> {
        return element;
    }

    refresh() {
        this._onDidChangeTreeData.fire(undefined);
    }

    refreshItem(item: vscode.TreeItem) {
        this._onDidChangeTreeData.fire(item);
    }
}

class LinkTreeItem extends vscode.TreeItem {
    project: MatchingProject;
    constructor(project: MatchingProject) {
        super(project.projectName);
        let problemsCount = project?.reportInfo?.problems?.total;
        let time = project.reportInfo.lastChecked;
        let tooltipText: string;
        if (problemsCount !== undefined && problemsCount > 0) {
            tooltipText = problemsCountString(problemsCount?.toString());
        } else {
            tooltipText = problemsCountString(undefined);
        }
        if (time) {
            let date = new Date(time);
            tooltipText += ` ${LAST_RUN} ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
        }
        this.tooltip = tooltipText;
        this.description = project.teamName;
        this.project = project;
        this.command = {
            command: COMMAND_SELECT_NODE,
            title: SELECT_PROJECT,
            arguments: [this.project.projectId]
        };
    }
}

export class OtherTreeItem extends vscode.TreeItem {
    projectId: string = '';
}