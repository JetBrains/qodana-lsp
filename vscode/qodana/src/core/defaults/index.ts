export function apiUrl() {
    if (process.env.QODANA_API_URL) {
        if (process.env.QODANA_API_URL.endsWith('/') && isValidURL(process.env.QODANA_API_URL)) {
            return process.env.QODANA_API_URL.slice(0, -1);
        }
        return process.env.QODANA_API_URL;
    }
    return 'https://api.qodana.cloud';
}

export function authUrl() {
    if (process.env.QODANA_AUTH_URL) {
        if (process.env.QODANA_AUTH_URL.endsWith('/') && isValidURL(process.env.QODANA_AUTH_URL)) {
            return process.env.QODANA_AUTH_URL.slice(0, -1);
        }
        return process.env.QODANA_AUTH_URL;
    }
    return 'https://oauth.account.jetbrains.com/oauth2/auth';
}

export function cloudWebsite() {
    if (process.env.QODANA_CLOUD_WEBSITE) {
        if (process.env.QODANA_CLOUD_WEBSITE.endsWith('/') && isValidURL(process.env.QODANA_CLOUD_WEBSITE)) {
            return process.env.QODANA_CLOUD_WEBSITE.slice(0, -1);
        }
        return process.env.QODANA_CLOUD_WEBSITE;
    }
    return 'https://qodana.cloud';
}

export function clientId() {
    if (process.env.QODANA_CLIENT_ID && isValidString(process.env.QODANA_CLIENT_ID)) {
        return process.env.QODANA_CLIENT_ID;
    }
    return 'qodana';
}

export function lookupFilesCount() {
    if (process.env.QODANA_LOOKUP_FILES_COUNT) {
        return parseInt(process.env.QODANA_LOOKUP_FILES_COUNT);
    }
    return 20;
}

function isValidURL(url: string): boolean {
    const pattern = /^[a-zA-Z0-9\-.:\/]*$/;
    return pattern.test(url);
}

export function isValidString(str: string): boolean {
    const pattern = /^[a-zA-Z0-9\-]*$/;
    return pattern.test(str);
}