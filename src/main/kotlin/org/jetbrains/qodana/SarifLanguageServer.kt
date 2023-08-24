package org.jetbrains.qodana

import org.apache.logging.log4j.LogManager
import org.eclipse.lsp4j.*
import org.eclipse.lsp4j.services.LanguageClient
import org.eclipse.lsp4j.services.LanguageClientAware
import org.eclipse.lsp4j.services.LanguageServer
import java.util.concurrent.CompletableFuture
import kotlin.system.exitProcess

class SarifLanguageServer: LanguageServer, LanguageClientAware {
    companion object {
        private val logger = LogManager.getLogger(SarifLanguageServer::class.java)
    }

    private val textDocumentService = SarifTextDocumentService(this)
    private val workspaceService = SarifWorkspaceService(this)
    private var clientCapabilities: ClientCapabilities? = null
    var languageClient: LanguageClient? = null
    private var exitCode = -1

    override fun initialize(params: InitializeParams?): CompletableFuture<InitializeResult> {
        logger.info("server/initialize")
        return CompletableFuture.supplyAsync {
            val capabilities = ServerCapabilities().apply {
                setTextDocumentSync(TextDocumentSyncKind.Full)
                setHoverProvider(true)
                diagnosticProvider = DiagnosticRegistrationOptions()
            }
            clientCapabilities = params?.capabilities
            InitializeResult(capabilities)
        }
    }

    override fun shutdown(): CompletableFuture<Any> {
        logger.info("server/shutdown")
        exitCode = 0
        return CompletableFuture.supplyAsync { }
    }

    override fun exit() {
        logger.info("server/exit")
        exitProcess(exitCode)
    }

    override fun connect(client: LanguageClient?) {
        logger.info("server/connect")
        languageClient = client
    }

    override fun getTextDocumentService() = textDocumentService

    override fun getWorkspaceService() = workspaceService
}