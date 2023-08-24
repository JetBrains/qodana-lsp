package org.jetbrains.qodana

import org.eclipse.lsp4j.Diagnostic
import org.eclipse.lsp4j.MessageActionItem
import org.eclipse.lsp4j.MessageParams
import org.eclipse.lsp4j.PublishDiagnosticsParams
import org.eclipse.lsp4j.ShowMessageRequestParams
import org.eclipse.lsp4j.services.LanguageClient
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentLinkedQueue

class SarifTestLanguageClient: LanguageClient {
    val messages = ConcurrentLinkedQueue<String>()
    val diagnostics = ConcurrentLinkedQueue<Diagnostic>()

    override fun telemetryEvent(`object`: Any?) { }

    override fun publishDiagnostics(diagnostics: PublishDiagnosticsParams) {
        this.diagnostics.addAll(diagnostics.diagnostics)
    }

    override fun showMessage(messageParams: MessageParams) {
        messages.add(messageParams.message)
    }

    override fun showMessageRequest(requestParams: ShowMessageRequestParams?): CompletableFuture<MessageActionItem> =
        CompletableFuture.supplyAsync { MessageActionItem() }

    override fun logMessage(message: MessageParams?) { }
}