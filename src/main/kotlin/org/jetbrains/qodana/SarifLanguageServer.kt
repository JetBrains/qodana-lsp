package org.jetbrains.qodana

import org.apache.logging.log4j.LogManager
import org.eclipse.lsp4j.*
import org.eclipse.lsp4j.services.LanguageClient
import org.eclipse.lsp4j.services.LanguageClientAware
import java.util.concurrent.CompletableFuture
import kotlin.system.exitProcess
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.Channel.Factory.UNLIMITED
import kotlinx.coroutines.flow.consumeAsFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.merge
import org.jetbrains.annotations.VisibleForTesting
import java.nio.file.Path
import java.util.concurrent.ConcurrentHashMap

@OptIn(FlowPreview::class)
class SarifLanguageServer: ExtendedLanguageServer, LanguageClientAware {
    companion object {
        private val logger = LogManager.getLogger(SarifLanguageServer::class.java)
    }

    private val workspaceService = SarifWorkspaceService()
    private var clientCapabilities: ClientCapabilities? = null
    private val scope = CoroutineScope(Dispatchers.IO)
    private val requestChannel = Channel<IRequest>(UNLIMITED)
    private val debouncedChannel = Channel<IRequest>(UNLIMITED)
    @VisibleForTesting
    internal val state = ServerState(requestChannel,
        debouncedChannel,
        System.getProperty("os.name").lowercase().contains("win"),
        scope)
    private val textDocumentService = SarifTextDocumentService(state)
    private var exitCode = -1
    init {
        scope.launch {
            merge(requestChannel.consumeAsFlow(), debouncedChannel.consumeAsFlow().debounce(DebounceInterval)).collect {
                it.execute(state)
            }
        }
    }



    override fun setSourceLocation(params: SetSourceLocationParams): CompletableFuture<Unit> {
        logger.info("server/setSourceLocation {fileUri: '${params.path}'}")
        val future = CompletableFuture<Unit>()

        scope.launch {
            try {
                requestChannel.send(SourceLocation(params.path))
                future.complete(Unit)
            } catch (ex: Exception) {
                future.completeExceptionally(ex)
            }
        }
        return future
    }

    override fun setSarifFile(params: SetSarifFileParams): CompletableFuture<Unit> {
        logger.info("server/setSarifFile {fileUri: '${params.path}'}")
        val future = CompletableFuture<Unit>()

        scope.launch {
            try {
                requestChannel.send(SarifFile(params.path, params.showBaselineIssues))
                future.complete(Unit)
            } catch (ex: Exception) {
                future.completeExceptionally(ex)
            }
        }
        return future
    }

    override fun closeReport(): CompletableFuture<Unit> {
        val future = CompletableFuture<Unit>()

        scope.launch {
            try {
                requestChannel.send(CloseReport())
                future.complete(Unit)
            } catch (ex: Exception) {
                future.completeExceptionally(ex)
            }
        }
        return future
    }

    override fun initialize(params: InitializeParams?): CompletableFuture<InitializeResult> {
        logger.info("server/initialize")
        return CompletableFuture.supplyAsync {
            val capabilities = ServerCapabilities().apply {
                setTextDocumentSync(TextDocumentSyncKind.Incremental)
                diagnosticProvider = DiagnosticRegistrationOptions()
            }
            clientCapabilities = params?.capabilities
            InitializeResult(capabilities)
        }
    }

    override fun setTrace(params: SetTraceParams?) {
        // do nothing
    }

    override fun shutdown(): CompletableFuture<Any> {
        logger.info("server/shutdown")
        return CompletableFuture.supplyAsync {

        }
    }

    override fun exit() {
        logger.info("server/exit")
        exitProcess(exitCode)
    }

    override fun connect(client: LanguageClient?) {
        logger.info("server/connect")
//        logger.info("$client")
        state.languageClient = client
    }

    override fun getTextDocumentService() = textDocumentService

    override fun getWorkspaceService() = workspaceService

    data class ServerState(val requestChannel: Channel<IRequest>,
                           val debounceChannel: Channel<IRequest>,
                           val isWindows: Boolean,
                           val scope: CoroutineScope,
                           var languageClient: LanguageClient? = null,
                           var sarifLocation: String? = null,
                           var pathPrefix: Path? = null,
                           var diagnostic: MutableMap<String, List<DiagnosticWithHighlight>>? = null,
                           var sarifRevision: Lazy<String?>? = null,
                           var repoFolder: Path? = null,
                           var gitLocator: Lazy<GitLocator?>? = null,
                           val openFileCache: MutableMap<String, String> = ConcurrentHashMap(),
                           var repositoryFileCache: MutableMap<String, String>? = null
    )
}