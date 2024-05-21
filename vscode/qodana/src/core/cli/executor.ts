
import * as vscode from 'vscode';
import { getLanguagesInWorkspace, getLinterByCode as getLinterImageByCode, getLinters, selectLinter } from './language';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import {NO_LINTERS_FOUND, NO_REPORT_FOUND, NO_WORKSPACE_OPENED, scanFinished} from '../messages';
import { Events } from '../events';
import {LOCAL_REPORT, WS_REPORT_ID} from '../config';

export async function showLocalReport(context: vscode.ExtensionContext, reportBasePath: string| undefined) {
    if (reportBasePath === undefined) {
        vscode.window.showInformationMessage(NO_REPORT_FOUND);
        return;
    }
    try {
        const reportPath = path.join(reportBasePath, 'qodana.sarif.json');
        await fs.promises.access(reportPath);
        await context.workspaceState.update(WS_REPORT_ID, LOCAL_REPORT);
        Events.instance.fireReportFile({ reportFile: reportPath, reportId: LOCAL_REPORT});
        vscode.commands.executeCommand("workbench.action.problems.focus");
    } catch (e) {
        vscode.window.showInformationMessage(NO_REPORT_FOUND);
    }
}

export async function
runQodana(cli: string, token: string): Promise<string | undefined> {
    let isPrepared = await prepareRun(token);
    if (isPrepared) {
        let tempDir = path.join(os.tmpdir(), Math.random().toString(36).substring(7));
        await fs.promises.mkdir(tempDir, { recursive: true });
        let exitStatus = await launchTerminal(cli, vscode.workspace.workspaceFolders![0].uri.fsPath, tempDir, token);
        vscode.window.showInformationMessage(scanFinished(exitStatus));
        return tempDir;
    }
}

export async function launchTerminal(cli: string, cwd: string, tempDir: string, token: string | undefined): Promise<number | undefined> {
    let options: vscode.TerminalOptions = {
        env: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            QODANA_TOKEN: token,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            NONINTERACTIVE: '1'
        },
        cwd: cwd,
        name: 'Qodana CLI',
    };
    let terminal = vscode.window.createTerminal(options);
    terminal.show();
    // cli could contain spaces in the path in the middle, they should be escaped
    cli = cli.replace(/ /g, '\\ ');
    terminal.sendText(`${cli} scan --results-dir ${tempDir} --user root`, false);
    terminal.sendText('; sleep 3; exit');
    return new Promise(resolve => {
        const dispose = vscode.window.onDidCloseTerminal(closedTerminal => {
            if (closedTerminal === terminal) {
                resolve(terminal.exitStatus?.code);
                dispose.dispose();
            }
        });
    });
}


export async function prepareRun(token: string): Promise<boolean> {
    let linter = await getLinterFromQodanaYaml();
    if (linter !== undefined) {
        return true;
    }
    let langs = await getLanguagesInWorkspace();
    let { communityLinters, paidLinters } = getLinters(langs);
    if (communityLinters.length === 0 && paidLinters.length === 0) {
        if (vscode.workspace.workspaceFolders === undefined) {
            vscode.window.showErrorMessage(NO_WORKSPACE_OPENED);
        } else {
            vscode.window.showErrorMessage(NO_LINTERS_FOUND);
        }
        return false;
    }

    let selectedLinter = await selectLinter(token, communityLinters, paidLinters);
    if (selectedLinter === undefined) {
        return false;
    }
    let selectedImage = getLinterImageByCode(selectedLinter);
    if (selectedImage === undefined) {
        return false;
    }
    await createQodanaYaml(selectedImage);
    return true;
}

async function getLinterFromQodanaYaml() {
    let yamlFiles = await vscode.workspace.findFiles('qodana.yaml', '', 1);
    if (yamlFiles.length === 1) {
        let yamlFile = yamlFiles[0];
        let yamlContent = await vscode.workspace.fs.readFile(yamlFile);
        let yamlString = new TextDecoder().decode(yamlContent);
        let lines = yamlString.split('\n');
        for (let line of lines) {
            if (line.startsWith('linter:')) {
                return line.split(':')[1].trim();
            }
            if (line.startsWith('ide:')) {
                return line.split(':')[1].trim();
            }
        }
    }
    return undefined;
}

async function createQodanaYaml(linter: string) {
    let rootPath = vscode.workspace.workspaceFolders![0].uri.fsPath; // existence of this path is checked before in extension
    let linterString = `linter: ${linter}`;
    let yamlContent = getTemplate(linterString);
    let yamlFile = vscode.Uri.file(rootPath + '/qodana.yaml');
    try {
        await vscode.workspace.fs.stat(yamlFile);
        let existingContent = await vscode.workspace.fs.readFile(yamlFile);
        yamlContent = new TextDecoder().decode(existingContent) + '\n' + linterString;
    } catch (e) {
        // ignore, file does not exist
    }
    await vscode.workspace.fs.writeFile(yamlFile, Buffer.from(yamlContent));
}

function getTemplate(linterString: string) {
    return TEMPLATE + '\n' + linterString;
}

const TEMPLATE = `
#-------------------------------------------------------------------------------#
#               Qodana analysis is configured by qodana.yaml file               #
#             https://www.jetbrains.com/help/qodana/qodana-yaml.html            #
#-------------------------------------------------------------------------------#
version: "1.0"

#Specify inspection profile for code analysis
profile:
  name: qodana.starter

#Enable inspections
#include:
#  - name: <SomeEnabledInspectionId>

#Disable inspections
#exclude:
#  - name: <SomeDisabledInspectionId>
#    paths:
#      - <path/where/not/run/inspection>

#Execute shell command before Qodana execution (Applied in CI/CD pipeline)
#bootstrap: sh ./prepare-qodana.sh

#Install IDE plugins before Qodana execution (Applied in CI/CD pipeline)
#plugins:
#  - id: <plugin.id> #(plugin id can be found at https://plugins.jetbrains.com)

#Specify Qodana linter for analysis (Applied in CI/CD pipeline)`.trim();