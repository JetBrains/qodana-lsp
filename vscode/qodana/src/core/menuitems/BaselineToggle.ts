import * as vscode from 'vscode';
import {BL_STATUS_ALL_ISSUES, BL_STATUS_NEW_ISSUES, BL_TTIP_ALL_ISSUES, BL_TTIP_NEW_ISSUES} from '../messages';

export class BaselineToggle {
    private static _instance: BaselineToggle;

    private statusItem: vscode.StatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    
    private constructor() {
        this.statusItem.command = 'qodana.toggleBaseline';
        this.statusItem.show();
    }

    public static get instance() {
        if (!BaselineToggle._instance) {
            BaselineToggle._instance = new BaselineToggle();
        }
        return BaselineToggle._instance;
    }

    toggle(showBaselineIssues: boolean) {
        if (showBaselineIssues) {
            this.statusItem.text = BL_STATUS_ALL_ISSUES;
            this.statusItem.tooltip = BL_TTIP_ALL_ISSUES;
        } else {
            this.statusItem.text = BL_STATUS_NEW_ISSUES;
            this.statusItem.tooltip = BL_TTIP_NEW_ISSUES;
        }
    }
}