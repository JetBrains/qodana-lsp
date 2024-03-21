package org.jetbrains.qodana

import kotlinx.coroutines.*
import org.apache.logging.log4j.LogManager
import org.eclipse.lsp4j.*
import org.eclipse.lsp4j.services.TextDocumentService
import java.net.URI
import java.net.URL
import java.nio.file.Paths
import java.util.concurrent.CompletableFuture

class SarifTextDocumentService(private val state: SarifLanguageServer.ServerState) : TextDocumentService {
    companion object {
        private val logger = LogManager.getLogger(SarifTextDocumentService::class.java)
    }

    override fun didOpen(params: DidOpenTextDocumentParams) {
        logger.trace("text/didOpen {fileUri: '${params.textDocument?.uri}'}")
        val url = params.textDocument?.uri ?: return
        if (!isFileScheme(url)) return
        state.scope.launch {
            state.requestChannel.send(OpenFile(url, params.textDocument?.text ?: Paths.get(URL(url).toURI()).toFile().readText()))
            state.debounceChannel.send(RemapDiagnostics(url))
        }
    }

    override fun diagnostic(params: DocumentDiagnosticParams?): CompletableFuture<DocumentDiagnosticReport> {
        return CompletableFuture.supplyAsync { DocumentDiagnosticReport(RelatedFullDocumentDiagnosticReport()) }
    }

    override fun didChange(params: DidChangeTextDocumentParams) {
        logger.trace("text/didChange {fileUri: '${params.textDocument?.uri}'}")
        val url = params.textDocument?.uri ?: return
        if (!isFileScheme(url)) return
        state.scope.launch {
            state.requestChannel.send(UpdateFile(url, params.contentChanges))
            state.debounceChannel.send(RemapDiagnostics(url))
        }
    }

    override fun didClose(params: DidCloseTextDocumentParams) {
        logger.trace("text/didClose {fileUri: '${params.textDocument?.uri}'}")
        val url = params.textDocument?.uri ?: return
        if (!isFileScheme(url)) return
        state.scope.launch {
            state.requestChannel.send(CloseFile(url))
        }
    }

    override fun didSave(params: DidSaveTextDocumentParams) {
        logger.trace("text/didSave {fileUri: '${params.textDocument?.uri}'}")
        val url = params.textDocument?.uri ?: return
        if (!isFileScheme(url)) return
        state.scope.launch {
            state.requestChannel.send(OpenFile(url, Paths.get(URL(url).toURI()).toFile().readText()))
            state.debounceChannel.send(RemapDiagnostics(url))
        }
    }

    private fun isFileScheme(uriString: String): Boolean {
        val uri = URI(uriString)
        return uri.scheme == "file"
    }
}