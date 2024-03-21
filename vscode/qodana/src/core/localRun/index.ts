import {Events} from "../events";
import {LOCAL_REPORT} from "../config";
import * as vscode from "vscode";
import {showLocalReport} from "../cli/executor";
import {extensionInstance} from "../extension";

export class LocalRunsService {
    private localReports = new Set<LocalReport>;
    private readonly context: vscode.ExtensionContext;
    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.initReportSubscription();
    }

    private initReportSubscription() {
        Events.instance.onReportFile((e) => {
            if (e.reportId === LOCAL_REPORT && e.reportFile) {
                if (Array.from(this.localReports).find(report => report.path === e.reportFile)) {
                    return;
                }
                let time = new Date(Date.now());
                this.localReports.add({
                    path: e.reportFile,
                    label: `${time.toLocaleDateString()} ${time.toLocaleTimeString()}`
                });
            }
        });
    }

    openLocalReportAction() {
        vscode.window.showQuickPick([... this.localReports]).then(async (selection) => {
            if (selection) {
                let path = selection.path.replace("qodana.sarif.json", "");
                await extensionInstance.closeReport();
                await showLocalReport(this.context, path);
            }
        });
    }
}

interface LocalReport {
    path: string
    label: string
}