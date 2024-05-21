import {Authorized, AuthState_, NotAuthorized} from "./index";
import {AuthorizingImpl} from "./AuthorizingImpl";
import * as vscode from "vscode";


export class NotAuthorizedImpl implements NotAuthorized {

    private readonly stateEmitter: vscode.EventEmitter<AuthState_>;
    private readonly context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext, stateEmitter: vscode.EventEmitter<AuthState_>) {
        this.stateEmitter = stateEmitter;
        this.context = context;
    }

    async authorize(frontendUrl?: string): Promise<NotAuthorized | Authorized> {
        let newState = new AuthorizingImpl(this.context, this.stateEmitter, frontendUrl);
        this.stateEmitter.fire(newState);
        return (await newState.startOauth());
    }
}