import * as vscode from "vscode";
import {
    QS_STATUS_ATTACHED,
    QS_STATUS_NOT_ATTACHED,
    QS_STATUS_SETTINGS_INVALID,
    QS_TIP_ATTACHED,
    QS_TIP_NOT_ATTACHED, QS_TIP_SETTINGS_INVALID
} from "../messages";

export class QodanaState {
    private static _instance: QodanaState;

    private statusItem: vscode.StatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    private warningBg = new vscode.ThemeColor('statusBarItem.warningBackground');

    private constructor() {
        this.statusItem.show();
    }

    public static get instance() {
        if (!QodanaState._instance) {
            QodanaState._instance = new QodanaState();
        }
        return QodanaState._instance;
    }


    attachedToReport(reportId: string | undefined) {
        this.statusItem.text = QS_STATUS_ATTACHED;
        this.statusItem.command = 'qodana.toggleQodana';
        this.statusItem.tooltip = QS_TIP_ATTACHED + reportId;
        this.statusItem.backgroundColor = undefined;
    }

    notAttachedToReport() {
        this.statusItem.text = QS_STATUS_NOT_ATTACHED;
        this.statusItem.tooltip = QS_TIP_NOT_ATTACHED;
        this.statusItem.command = 'qodana.toggleQodana';
        this.statusItem.backgroundColor = this.warningBg;
    }

    settingsNotValid() {
        this.statusItem.text = QS_STATUS_SETTINGS_INVALID;
        this.statusItem.tooltip = QS_TIP_SETTINGS_INVALID;
        this.statusItem.command = 'qodana.openWorkspaceSettings';
        this.statusItem.backgroundColor = undefined;
    }
}