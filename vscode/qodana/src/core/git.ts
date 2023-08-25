// access git extension of vscode
// https://github.com/microsoft/vscode/blob/08d383346c18f6b20cb74219611f7c1b590c35b1/extensions/git/README.md#git-integration-for-visual-studio-code

import * as vscode from 'vscode';
import { GitExtension, Repository } from './git/git';
import { GIT_EXT_NOT_FOUND, GIT_ORIGIN_NOT_FOUND, GIT_REMOTE_NOT_FOUND } from './messages';

export function getGitRepository(): Repository | undefined {
    const vscodeGit = vscode.extensions.getExtension<GitExtension>('vscode.git')?.exports;
    if (!vscodeGit) {
        vscode.window.showErrorMessage(GIT_EXT_NOT_FOUND);
        return;
    }
    const gitExtension = vscodeGit.getAPI(1);
    return gitExtension.repositories[0];
}

export function getRemoteOrigin(): string | undefined {
    const git = getGitRepository();
    if (!git) {
        return;
    }
    const remotes = git.state.remotes;
    if (!remotes || remotes.length === 0) {
        vscode.window.showErrorMessage(GIT_REMOTE_NOT_FOUND);
        return;
    }
    const origin = remotes[0].fetchUrl;
    if (!origin) {
        vscode.window.showErrorMessage(GIT_ORIGIN_NOT_FOUND);
        return;
    }
    return origin;
}
