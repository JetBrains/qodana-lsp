package org.jetbrains.qodana

import com.jetbrains.qodana.sarif.model.Level
import org.apache.logging.log4j.LogManager
import org.eclipse.lsp4j.*
import org.eclipse.lsp4j.services.LanguageServer
import org.eclipse.lsp4j.services.TextDocumentService
import java.nio.file.Path
import java.util.concurrent.ConcurrentHashMap

class SarifTextDocumentService(val server: SarifLanguageServer) : TextDocumentService {
    companion object {
        private val logger = LogManager.getLogger(SarifTextDocumentService::class.java)
    }

    val sarifFiles : ConcurrentHashMap<String, List<Diagnostic>> = ConcurrentHashMap()
    val dir = Path.of(System.getProperty("workspacePath", ""))
    val sarifPath = "/Users/dgolovinov/JetBrains/experiments/rd/results/qodana.sarif.json"

    fun getProblems(): Sequence<com.jetbrains.qodana.sarif.model.Result> = sequence {
        java.io.FileReader(sarifPath).use { fileReader ->
            for (indexedResult in com.jetbrains.qodana.sarif.SarifUtil.lazyReadIndexedResults(fileReader)) {
                yield(indexedResult.result)
            }
        }
    }

    override fun didOpen(params: DidOpenTextDocumentParams) {
        logger.info("text/didOpen {fileUri: '${params.textDocument?.uri}'}")
        val uri = params.textDocument?.uri?.removePrefix("file://")
        if (uri != null) {
            val rel = dir.relativize(Path.of(uri)).toString()
            val match = sarifFiles.getOrPut(rel) {
                val diags = mutableListOf<Diagnostic>()
                for (problem in getProblems()) {
                    if (problem.locations != null && problem.locations.isNotEmpty()) {
                        val location = problem.locations[0]
                        val locationUri = location.physicalLocation?.artifactLocation?.uri
                        val region = location.physicalLocation?.region
                        if (locationUri == rel && region != null) {
                            val severity = when (problem.level) {
                                Level.WARNING -> DiagnosticSeverity.Warning
                                Level.ERROR -> DiagnosticSeverity.Warning
                                Level.NOTE -> DiagnosticSeverity.Hint
                                else -> continue
                            }
                            val diagnostic = Diagnostic(
                                Range(
                                    Position(region.startLine - 1, region.startColumn - 1),
                                    Position(region.startLine - 1, region.startColumn + region.charLength - 1)
                                ),
                                problem.message.text,
                                severity,  // Or Warning, Information, Hint depending on result.level
                                "",  // Your server's name or id
                                problem.ruleId   // The error's code if provided in the SARIF result
                            )
                            diags.add(diagnostic)
                        }
                    }
                }
                diags
            }
            if (match.isNotEmpty()) {
                server.languageClient?.publishDiagnostics(PublishDiagnosticsParams(params.textDocument?.uri, match))
            }
        }

    }

    override fun didChange(params: DidChangeTextDocumentParams?) {
        logger.info("text/didChange {fileUri: '${params?.textDocument?.uri}'}")
    }

    override fun didClose(params: DidCloseTextDocumentParams?) {
        logger.info("text/didClose {fileUri: '${params?.textDocument?.uri}'}")
    }

    override fun didSave(params: DidSaveTextDocumentParams?) {
        logger.info("text/didSave {fileUri: '${params?.textDocument?.uri}'}")
    }
}