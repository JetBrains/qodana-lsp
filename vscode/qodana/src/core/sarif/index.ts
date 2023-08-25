import * as vscode from 'vscode';
import * as fs from 'fs';
import * as readline from 'readline';
import { lookupFilesCount } from '../defaults';
import * as events from 'events';


class SarifLookup {
    private static _instance: SarifLookup;
    private constructor() { }

    public static get instance(): SarifLookup {
        if (!this._instance) {
            this._instance = new SarifLookup();
        }
        return this._instance;
    }

    async findPrefix(sarifFilePath: string): Promise<string | undefined> {
        let locations = await this.getLocations(sarifFilePath);
        let commonPrefixes = new Map<string, number>();
        for (let location of locations) {
            let prefix = await this.findFileByPathEnd(location);
            if (prefix) {
                let count = commonPrefixes.get(prefix);
                if (count) {
                    commonPrefixes.set(prefix, count + 1);
                } else {
                    commonPrefixes.set(prefix, 1);
                }
            }
        }
        if (commonPrefixes.size === 0) {
            return undefined;
        }
        let maxCount = 0;
        let maxPrefix = '';
        for (let [prefix, count] of commonPrefixes) {
            if (count > maxCount) {
                maxCount = count;
                maxPrefix = prefix;
            }
        }
        if (maxCount >= commonPrefixes.size / 2) {
            return maxPrefix;
        }
        return undefined;
    }


    async findFileByPathEnd(pathEnd: string): Promise<string | undefined> {
        let files = await vscode.workspace.findFiles(`**/${pathEnd}`);
        if (files.length === 1) {
            let fullPath = files[0].fsPath;
            return fullPath.substring(0, fullPath.length - pathEnd.length - 1);
        }
        return undefined;
    }

    async getLocations(sarifFilePath: string): Promise<Set<string>> {
        const fileStream = fs.createReadStream(sarifFilePath, { highWaterMark: 1024 });
        await events.once(fileStream, 'open');
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        let linesWithUri = new Set<string>();

        const uriRegex = /^\s*"uri"\s*:\s*"([^"]*)"/;

        for await (const line of rl) {
            if (uriRegex.test(line)) {
                let match = line.match(uriRegex);
                if (!match || match.length < 2) {
                    continue;
                }
                linesWithUri.add(match[1]);
                if (linesWithUri.size === lookupFilesCount()) {
                    rl.close();
                    fileStream.close();
                    return linesWithUri;
                }
            }
        }
        return linesWithUri;
    }
}

export default SarifLookup.instance;