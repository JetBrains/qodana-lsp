package org.jetbrains.qodana

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.Channel.Factory.UNLIMITED
import kotlinx.coroutines.flow.consumeAsFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.merge
import kotlinx.coroutines.launch
import org.apache.logging.log4j.LogManager
import org.eclipse.lsp4j.*
import org.eclipse.lsp4j.services.LanguageClient
import org.eclipse.lsp4j.services.LanguageClientAware
import org.jetbrains.annotations.VisibleForTesting
import java.nio.file.Path
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ConcurrentHashMap
import kotlin.system.exitProcess

@OptIn(FlowPreview::class)
class SarifLanguageServer: ExtendedLanguageServer, LanguageClientAware {
    companion object {
        private val logger = LogManager.getLogger(SarifLanguageServer::class.java)
    }

    private val workspaceService = SarifWorkspaceService()
    private val serverCapabilities = ServerCapabilities().apply {
        setTextDocumentSync(TextDocumentSyncKind.Incremental)
        diagnosticProvider = DiagnosticRegistrationOptions()
    }
    private val scope = CoroutineScope(Dispatchers.IO)
    private val requestChannel = Channel<IRequest>(UNLIMITED)
    private val debouncedChannel = Channel<IRequest>(UNLIMITED)
    @VisibleForTesting
    internal val state = ServerState(requestChannel,
        debouncedChannel,
        System.getProperty("os.name").lowercase().contains("win"),
        scope)
    private val textDocumentService = SarifTextDocumentService(state)
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
        logger.info("server/closeReport")
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
        return CompletableFuture.completedFuture(InitializeResult(serverCapabilities))
    }

    override fun setTrace(params: SetTraceParams?) {
        // do nothing
    }

    override fun shutdown(): CompletableFuture<Any> {
        logger.info("server/shutdown")
        requestChannel.close()
        debouncedChannel.close()
        return CompletableFuture.completedFuture(null)
    }

    override fun exit() {
        logger.info("server/exit")
        exitProcess(0)
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