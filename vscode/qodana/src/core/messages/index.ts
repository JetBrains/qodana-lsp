import * as vscode from 'vscode';

// GIT

export const GIT_EXT_NOT_FOUND = vscode.l10n.t('[Qodana] Git extension not found.');
export const GIT_REMOTE_NOT_FOUND = vscode.l10n.t('[Qodana] Git remote not found.');
export const GIT_ORIGIN_NOT_FOUND = vscode.l10n.t('[Qodana] Git origin not found.');

// AUTH

export const AUTH_FAILED = vscode.l10n.t('[Qodana] Authentication to Qodana Cloud failed.');
export const AUTH_NEEDED = vscode.l10n.t('[Qodana] Authorization for Qodana Cloud is required.');
export const PROCEED = vscode.l10n.t('Proceed');
export const CANCEL = vscode.l10n.t('Cancel');
export const FAILED_TO_OBTAIN_TOKEN = vscode.l10n.t('[Qodana] Failed to obtain token. Try "Qodana: Reset authentication" command and re-connect your project.');
export const FAILED_TO_RENEW_TOKEN = vscode.l10n.t('[Qodana] Failed to renew token. Try "Qodana: Reset authentication" command and re-connect your project.');
export const FAILED_TO_AUTHENTICATE = vscode.l10n.t('[Qodana] Authentication to Qodana Cloud failed: ');
export const SELF_HOSTED_TOOLTIP = vscode.l10n.t('Input Qodana Self-Hosted Url');
export function loggedInAs(username: string | undefined) { return vscode.l10n.t('Logged in as {0}', username || 'unknown'); }

// ACTIVITIES

export const NEW_REPORT_AVAILABLE = vscode.l10n.t('[Qodana] There is a new report available. Would you like to open it?');
export const SHOW_PROBLEMS = vscode.l10n.t('Show Problems');
export const YES = vscode.l10n.t('Yes');
export const NO = vscode.l10n.t('No');
export const CLOUD_REPORT_LOADED = vscode.l10n.t('[Qodana] Cloud report has been successfully loaded.');
export function computedPrefix(prefix: string|undefined) { return vscode.l10n.t('[Qodana] Computed prefix: {0}.', prefix || 'unknown'); }

// CLIENT

export const FAILED_TO_INITIALIZE = vscode.l10n.t('[Qodana] Failed to initialize extension. Please try restarting VS Code or reinstalling extension. If issue persists, please contact us via YouTrack.');
export const JAVA_NOT_FOUND = vscode.l10n.t('[Qodana] Java executable not found in PATH. Please ensure Java is installed and its path is added to system PATH.');

// CONFIG

export const PROJECT_ID_NOT_SET = vscode.l10n.t('[Qodana] Project ID has not been configured in extension settings. Please configure it and try again.');
export const PATH_PREFIX_NOT_SET = vscode.l10n.t('[Qodana] Path prefix is set to non-existing folder. Refer to extension description for guidance on how to set it properly.');
export const USER_LEVEL_SETTINGS = vscode.l10n.t('[Qodana] User-level settings are not supported. Click "Proceed" to reset them, and then use Workspace tab for configurations.');
export const ULS_PROCEED = vscode.l10n.t('Proceed');
export const RELOAD_TO_APPLY = vscode.l10n.t('[Qodana] Please reload to apply changes.');
export const RELOAD = vscode.l10n.t('Reload');

// HANDLER

export function idNotSet(id: string) { return vscode.l10n.t('[Qodana] Project ID has not been configured in extension settings. \n Set it to {0} to show report.', id); }
export function idNotEqual(id: string) { return vscode.l10n.t('[Qodana] Project ID in extension settings does not match project ID in report. \n Set it to {0} to load report.', id); }
export const ID_SET = vscode.l10n.t('Set');
export const ID_CANCEL = vscode.l10n.t('Cancel');
export const FAILED_PATH_NOT_PRESENT = vscode.l10n.t('[Qodana] Failed to open report. path is missing from URI. Please refer to extension description for guidance.');
export const FAILED_ID_NOT_PRESENT = vscode.l10n.t('[Qodana] Failed to open report. Project ID is missing from extension settings. Refer to extension description for guidance on how to set it properly.');
export const FAILED_REPORT_ID_NOT_PRESENT = vscode.l10n.t('[Qodana] Failed to open report. Report ID is missing in the URL.');
export const FAILED_PREFIX_NOT_SET = vscode.l10n.t('[Qodana] Path prefix is not set in settings. Refer to extension description for guidance on how to set it properly.');

// REPORT

export function failedToObtainData(projectId: string) { return vscode.l10n.t('[Qodana] Unable to retrieve data for project {0}.', projectId); }
export function noReportsFound(projectId: string) { return vscode.l10n.t('[Qodana] No reports available for project {0}.', projectId); }
export function failedToObtainReportId(reportId: string, projectId: string) { return vscode.l10n.t('[Qodana] Unable to retrieve report ID {0} for project {1}.', reportId, projectId); }
export function noFilesFound(reportId: string, projectId: string) { return vscode.l10n.t('[Qodana] No files available for report ID {0} in project {1}.', reportId, projectId); }
export function failedToObtainReport(reportId: string, projectId: string) { return vscode.l10n.t('[Qodana] Unable to retrieve report id {0} for project {1}.', reportId, projectId); }
export function failedToDownloadReport(projectId: string) { return vscode.l10n.t('[Qodana] Unable to download report for specified project {0}.', projectId); }
export function failedToDownloadReportWithId(projectId: string, reportId: string) { return vscode.l10n.t('[Qodana] Unable to download report {0} for specified project {1}.', reportId, projectId); }
export function projectIdIsNotValid(projectId: string) { return vscode.l10n.t('[Qodana] Project ID {0} is not valid.', projectId); }

// JBR

export function failedToDownloadJbr(jbr: string) { return vscode.l10n.t('[Qodana] Unable to download JBR Runtime {0}.', jbr); }
export function failedToExtractJbr(jbr: string) { return vscode.l10n.t('[Qodana] Unable to extract JBR Runtime {0}.', jbr); }
export const DOWNLOAD_CONFIRMATION = vscode.l10n.t('[Qodana] requires Java 11 or higher to run. Do you want to download and use JetBrains Runtime?');
export function successfullyExtracted(jbr: string) { return vscode.l10n.t('[Qodana] Extracted JBR Runtime to {0}.', jbr); }

// CLI

export function cliUnsupportedArch(arch: string) { return vscode.l10n.t('[Qodana] Unsupported architecture {0}.', arch); }
export function cliUnsupportedPlatform(platform: string) { return vscode.l10n.t('[Qodana] Unsupported platform {0}.', platform); }
export function failedToDownloadCli(cli: string) { return vscode.l10n.t('[Qodana] Unable to download CLI {0}.', cli); }
export function failedToExtractCli(cli: string) { return vscode.l10n.t('[Qodana] Unable to extract CLI {0}.', cli); }
export function cliChecksumMismatch(cli: string) { return vscode.l10n.t('[Qodana] Checksum mismatch for CLI {0}.', cli); }
export function cliSuccessfullyExtracted(cli: string) { return vscode.l10n.t('[Qodana] Extracted CLI to {0}.', cli); }
export const CLI_DOWNLOAD_CONFIRMATION = vscode.l10n.t('[Qodana] requires CLI to run. Do you want to download and use it?');

// TOKEN

export const GET_TOKEN = vscode.l10n.t('[Qodana] Enter Qodana token.');

// SELECTION 

export const NO_LINTERS_FOUND = vscode.l10n.t('[Qodana] No supported linters found in the workspace.');

// CLI EXECUTION 

export function scanFinished(exitStatus: number| undefined) { 
    if (exitStatus) { return vscode.l10n.t('[Qodana] Scan finished with exit code {0}.', exitStatus); }
    return vscode.l10n.t('[Qodana] Scan finished with unknown exit code.');
}
export const NO_REPORT_FOUND = vscode.l10n.t('[Qodana] No report found.');

// baseline toggler

export const BL_STATUS_ALL_ISSUES = vscode.l10n.t('$(filter-filled) All issues');
export const BL_TTIP_ALL_ISSUES = vscode.l10n.t('[Qodana] Baseline issues are shown');
export const BL_STATUS_NEW_ISSUES = vscode.l10n.t('$(filter) New issues');
export const BL_TTIP_NEW_ISSUES = vscode.l10n.t('[Qodana] Baseline issues are hidden');

// qodana state

export const QS_STATUS_ATTACHED = vscode.l10n.t('$(eye) Qodana');
export const QS_TIP_ATTACHED = vscode.l10n.t('Attached to report: ');
export const QS_STATUS_NOT_ATTACHED = vscode.l10n.t('$(eye-closed) Qodana');
export const QS_TIP_NOT_ATTACHED = vscode.l10n.t('Not attached to report');
export const QS_STATUS_SETTINGS_INVALID = vscode.l10n.t('$(gear) Qodana');
export const QS_TIP_SETTINGS_INVALID = vscode.l10n.t('Settings are not valid');


// LINK
export const OTHER_PROJECT_TOOLTIP = vscode.l10n.t('Input Qodana Project ID');
export function problemsCountString(problemsCount: string | undefined) { return vscode.l10n.t('{0} Problems.', problemsCount || 'No'); }
export const LAST_RUN = vscode.l10n.t('Last run:');
export const SELECT_PROJECT = vscode.l10n.t('Select Project');
export const LINK_OTHER_PROJECT = vscode.l10n.t('Link other project');
export const OTHER_PROJECT = vscode.l10n.t('Other project');
export function linkedToProject(projectName: string | undefined) { return vscode.l10n.t('Linked to project {0}', projectName || '[Error while getting name]'); }