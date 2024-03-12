import * as vscode from 'vscode';

let extensionToLanguageMap = new Map<string, string[]>();
extensionToLanguageMap.set('java', ['Java', 'Kotlin']);
extensionToLanguageMap.set('kt', ['Java', 'Kotlin']);
extensionToLanguageMap.set('kts', ['Java', 'Kotlin']);
extensionToLanguageMap.set('php', ['PHP']);
extensionToLanguageMap.set('py', ['Python']);
extensionToLanguageMap.set('js', ['JavaScript', 'TypeScript']);
extensionToLanguageMap.set('ts', ['JavaScript', 'TypeScript']);
extensionToLanguageMap.set('go', ['Go']);
extensionToLanguageMap.set('cs', ['C#', 'F#', 'Visual Basic .NET']);
extensionToLanguageMap.set('fs', ['C#', 'F#', 'Visual Basic .NET']);
extensionToLanguageMap.set('vb', ['C#', 'F#', 'Visual Basic .NET']);

let languageToProductCodeMap = new Map<string, string[]>();
languageToProductCodeMap.set('Java', ['QDJVMC', 'QDJVM', 'QDANDC']);
languageToProductCodeMap.set('Kotlin', ['QDJVMC', 'QDJVM', 'QDANDC']);
languageToProductCodeMap.set('PHP', ['QDPHP']);
languageToProductCodeMap.set('Python', ['QDPYC', 'QDPY']);
languageToProductCodeMap.set('JavaScript', ['QDJS']);
languageToProductCodeMap.set('TypeScript', ['QDJS']);
languageToProductCodeMap.set('Go', ['QDGO']);
languageToProductCodeMap.set('C#', ['QDNET', 'QDNETC']);
languageToProductCodeMap.set('F#', ['QDNET']);
languageToProductCodeMap.set('Visual Basic .NET', ['QDNET', 'QDNETC']);

// every code that ends with C is a community code
let communityCodes = new Set<string>();
communityCodes.add('QDPYC');
communityCodes.add('QDJVMC');
communityCodes.add('QDANDC');
communityCodes.add('QDNETC');

let productCodeToDockerImageMap = new Map<string, string>();
productCodeToDockerImageMap.set('QDANDC', 'jetbrains/qodana-jvm-android:');
productCodeToDockerImageMap.set('QDPHP', 'jetbrains/qodana-php:');
productCodeToDockerImageMap.set('QDJS', 'jetbrains/qodana-js:');
productCodeToDockerImageMap.set('QDNET', 'jetbrains/qodana-dotnet:');
productCodeToDockerImageMap.set('QDNETC', 'jetbrains/qodana-cdnet:');
productCodeToDockerImageMap.set('QDPY', 'jetbrains/qodana-python:');
productCodeToDockerImageMap.set('QDPYC', 'jetbrains/qodana-python-community:');
productCodeToDockerImageMap.set('QDGO', 'jetbrains/qodana-go:');
productCodeToDockerImageMap.set('QDJVM', 'jetbrains/qodana-jvm:');
productCodeToDockerImageMap.set('QDJVMC', 'jetbrains/qodana-jvm-community:');

const versionPrefix = 'latest';

export async function getLanguagesInWorkspace() {
    const langsAndCounts = new Map<string, number>();
    const files = await vscode.workspace.findFiles('**/*.*', '', 1000);
    files.forEach(file => {
        const extension = vscode.workspace.asRelativePath(file).split('.').pop();
        if (extension) {
            let language = extensionToLanguageMap.get(extension);
            if (language) {
                language.forEach(lang => {
                    langsAndCounts.set(lang, (langsAndCounts.get(lang) || 0) + 1);
                });
            }
        }
    });
    // sort by count and return only the list of languages
    langsAndCounts[Symbol.iterator] = function* () {
        yield* [...this.entries()].sort((a, b) => b[1] - a[1]);
    };
    return Array.from(langsAndCounts.keys());
}

export function getLinters(langs: string[]): { communityLinters: string[]; paidLinters: string[] }{
    const linters = new Set<string>();
    for (const lang of langs) {
        if (languageToProductCodeMap.has(lang)) {
            for (const code of languageToProductCodeMap.get(lang)!){
                linters.add(code);
            }
        }
    }

    let lintersList = Array.from<string>(linters);
    let communityLinters = lintersList.filter(linter => communityCodes.has(linter));
    let paidLinters = lintersList.filter(linter => !communityCodes.has(linter));
    return { communityLinters, paidLinters };
}

export function getLinterByCode(code: string): string| undefined {
    let linter = productCodeToDockerImageMap.get(code);
    if (linter) {
        return linter + versionPrefix;
    }
    return undefined;
}


export async function selectLinter(token: string, communityLinters: string[], paidLinters: string[]): Promise<string | undefined> {
    let allLinters: string[] = communityLinters;
    if (token) {
        allLinters = paidLinters.concat(communityLinters);
    }
    if (allLinters.length === 0) {
        return undefined;
    }
    if (allLinters.length === 1) {
        return allLinters[0];
    }

    let choices = allLinters.map(linter => {
        let language = Array.from(languageToProductCodeMap.keys()).find(key => languageToProductCodeMap.get(key)?.includes(linter));
        let isCommunity = communityLinters.includes(linter);
        let communityPrefix = isCommunity ? 'Community ' : '';
        return {label: linter, description: `${linter} (${communityPrefix}${language})`};
    });

    let choice = await vscode.window.showQuickPick(choices, {placeHolder: 'Select a linter'});
    return choice?.label;
}