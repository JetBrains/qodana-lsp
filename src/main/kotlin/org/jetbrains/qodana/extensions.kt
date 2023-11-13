package org.jetbrains.qodana

import org.eclipse.lsp4j.Diagnostic
import org.eclipse.lsp4j.DiagnosticSeverity
import org.eclipse.lsp4j.Range
import org.eclipse.lsp4j.jsonrpc.services.JsonRequest
import org.eclipse.lsp4j.services.LanguageServer
import java.util.concurrent.CompletableFuture


interface ExtendedLanguageServer : LanguageServer {
    @JsonRequest
    fun setSourceLocation(params: SetSourceLocationParams) : CompletableFuture<Unit>

    @JsonRequest
    fun setSarifFile(params: SetSarifFileParams) : CompletableFuture<Unit>
}

data class SetSourceLocationParams(val path: String)

data class SetSarifFileParams(val path: String, val showBaselineIssues: Boolean)

class DiagnosticWithHighlight(range: Range, message: String, severity: DiagnosticSeverity, source: String, code: String, val highlightedText: String): Diagnostic(range, message, severity, source, code)