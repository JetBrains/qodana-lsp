import * as vscode from 'vscode';
import {COMMAND_OPEN_QODANA_TAB} from '../config';
import {QS_STATUS_SETTINGS, QS_TIP_SETTINGS} from '../messages';

export class QodanaState {
    private static _instance: QodanaState;

    private statusItem: vscode.StatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);

    private constructor() {
        this.statusItem.text = QS_STATUS_SETTINGS;
        this.statusItem.tooltip = QS_TIP_SETTINGS;
        this.statusItem.command = COMMAND_OPEN_QODANA_TAB;
        this.statusItem.show();
    }

    public static get instance() {
        if (!QodanaState._instance) {
            QodanaState._instance = new QodanaState();
        }
        return QodanaState._instance;
    }
}