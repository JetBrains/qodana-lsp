
import * as vscode from 'vscode';
import { QODANA_TOKEN } from '../auth';
import { GET_TOKEN } from '../messages';

export async function obtainToken(context: vscode.ExtensionContext): Promise<string | undefined> {
    let savedToken = process.env.QODANA_TOKEN || await context.secrets.get(QODANA_TOKEN);
    let token = await vscode.window.showInputBox({
        prompt: GET_TOKEN,
        ignoreFocusOut: true,
        password: true,
        value: savedToken
    });
    if (token !== undefined) {
        await context.secrets.store(QODANA_TOKEN, token);
    }
    return token;
}