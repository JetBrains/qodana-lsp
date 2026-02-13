import {cloudWebsite} from '../defaults';
import {qodanaCloudUnauthorizedApi} from './api';
import {extensionInstance} from '../extension';


export class CloudEnvironment {
    private lastBackendUrlsRequest: Promise<BackendUrls | undefined> | undefined = undefined;
    public frontendUrl: string;

    constructor(frontendUrl?: string) {
        this.frontendUrl = frontendUrl ? frontendUrl : cloudWebsite();
    }

    async getBackendUrlForVersion(version: string) {
        let urls = await this.getBackendUrls();
        return urls?.api?.versions?.find(
            versionUrl=> versionUrl.version.split('.')[0] === version
        )?.url;
    }

    async getBackendUrls() {
        if (this.lastBackendUrlsRequest === undefined) {
            this.lastBackendUrlsRequest = new Promise (async (resolve, reject) => {
                try {
                    let urls = await qodanaCloudUnauthorizedApi(this).getBackendUrls(this.frontendUrl);
                    if (urls !== undefined) {
                        resolve(urls);
                        return;
                    }
                    this.lastBackendUrlsRequest = undefined;
                    reject();
                } catch (error) {
                    reject(error);
                }
            });
        }
        return await this.lastBackendUrlsRequest;
    }

    async isPkceSupported(): Promise<boolean> {
        const urls = await this.getBackendUrls();
        const apiVersion = urls?.api?.versions?.find(v => v.version.startsWith('1.'))?.version;
        if (apiVersion) {
            const minorVersion = parseInt(apiVersion.split('.')[1]);
            return minorVersion >= 37;
        }
        return false;
    }

}

export interface BackendUrls {
    api: VersionHolder;
    linters: VersionHolder;
}

interface VersionHolder {
    versions: VersionUrl[];
}

interface VersionUrl {
    version: string;
    url: string
}

export function getHeaders(token: string | undefined = undefined, customHeaders: { [key: string]: string } = {}): {
    [key: string]: string
} {
    let version = extensionInstance.getVersion();
    let headers: { [key: string]: string } = {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'User-Agent': 'Qodana_VSCode_Plugin:' + version,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'Content-Type': 'application/json',
        ...customHeaders
    };
    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }
    return headers;
}