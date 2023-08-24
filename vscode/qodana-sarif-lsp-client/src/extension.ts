// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { extensionInstance } from './core/extension';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	//Set the context of the extension instance
	extensionInstance.setContext(context);
	//Initialize the LS Client extension instance.
	extensionInstance.init().catch((error)=> {
		console.log("Failed to activate Ballerina extension. " + (error));
	});
}

// This method is called when your extension is deactivated
export function deactivate() {}
