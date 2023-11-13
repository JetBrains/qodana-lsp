import { reportPath } from '../report';
import * as vscode from "vscode";
import {
    LanguageClientOptions,
    RevealOutputChannelOn,
} from "vscode-languageclient";

import {
    ExecutableOptions,
    LanguageClient,
    ServerOptions,
    State,
} from "vscode-languageclient/node";
import { FAILED_TO_INITIALIZE, JAVA_NOT_FOUND } from "../messages";
import { getJavaForExecution } from "../jdk/jbrDownloader";


const LS_LAUNCHER_MAIN: string = "org.jetbrains.qodana.SarifLanguageServerLauncher";
const outputChannel = vscode.window.createOutputChannel("Qodana");

export async function getLanguageClient(context: vscode.ExtensionContext): Promise<LanguageClient> {
    let serverOptions = await getServerOptions(context);
    if (!serverOptions) {
        return Promise.reject("Failed to initialize the extension: failed to get server options");
    }
    let clientId = "qodana-vscode-lsclient";
    let clientName = "Qodana LS Client";
    // Client options should support C#, JS, TS and Java files in documentSelector
    let clientOptions: LanguageClientOptions = {
        documentSelector: [
            {
                pattern: "**/*.*",
            },
        ],
        outputChannel: outputChannel,
        revealOutputChannelOn: RevealOutputChannelOn.Never,
    };
    let languageClient = new LanguageClient(
        clientId,
        clientName,
        serverOptions,
        clientOptions
    );
    const disposeDidChange = languageClient.onDidChangeState(
        async (stateChangeEvent) => {
            if (stateChangeEvent.newState === State.Stopped) {
                vscode.window.showErrorMessage(FAILED_TO_INITIALIZE);
            } else if (stateChangeEvent.newState === State.Running) {
                disposeDidChange.dispose();
            }
        }
    );
    return languageClient;
}

async function getServerOptions(context: vscode.ExtensionContext): Promise<ServerOptions | null> {
    let javaExecutablePath = await getJavaForExecution(context);
    if (!javaExecutablePath) {
        vscode.window.showErrorMessage(JAVA_NOT_FOUND);
        return null;
    }
    let jarPath = getJarPath(context);
    let args = ["-cp", jarPath];
    if (process.env.QODANA_DEBUG) {
        args.push("-agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=5005,quiet=y");
    }
    args.push(LS_LAUNCHER_MAIN);
    // set cwd to the workspace folder
    let cwd = await reportPath(context, '');
    let options: ExecutableOptions = {};
    if (cwd) {
        options = { cwd: cwd };
    }
    return { command: javaExecutablePath, args: args, options: options };
}

function getJarPath(context: vscode.ExtensionContext): string {
    return `${context.asAbsolutePath('lib/')}*`;
}
