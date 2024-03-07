import * as vscode from 'vscode';
import {MatchingProject} from "../cloud/api";

export class ProjectsView implements vscode.TreeDataProvider<vscode.TreeItem> {
    protected _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    readonly getProjects: () => Promise<MatchingProject[] | undefined>;

    constructor(getProjects: () => Promise<MatchingProject[] | undefined>) {
        this.getProjects = getProjects;
        vscode.commands.registerCommand('qodanaTreeItem.other-item', async (otherItem: vscode.TreeItem) => {
            const userInput = await vscode.window.showInputBox({
                prompt: "Input Qodana Project ID",
            });
            if (userInput !== undefined) {
                // todo handle error
                otherItem.label = "Other project: " + userInput;
                this._onDidChangeTreeData.fire(otherItem);
                vscode.commands.executeCommand("qodanaLinkView.selectNode", userInput);
            }
        });
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

        const otherItem = new vscode.TreeItem("Other project");
        otherItem.command = {
            command: 'qodanaTreeItem.other-item',
            title: "Link other project",
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
}

class LinkTreeItem extends vscode.TreeItem {
    project: MatchingProject;
    constructor(project: MatchingProject) {
        super(project.projectName);
        let problemsCount = project?.reportInfo?.problems?.total;
        let time = project.reportInfo.lastChecked;
        let tooltipText: string;
        if (problemsCount) {
            tooltipText = `${problemsCount} problems.`;
        } else {
            tooltipText = "No problems.";
        }
        if (time) {
            let date = new Date(time);
            tooltipText += ` Last run: ${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
        }
        this.tooltip = tooltipText;
        this.description = project.teamName;
        this.project = project;
        this.command = {
            command: 'qodanaLinkView.selectNode',
            title: "Select Project",
            arguments: [this.project.projectId]
        };
    }
}