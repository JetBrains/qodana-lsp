import org.apache.logging.log4j.LogManager
import org.eclipse.lsp4j.DidChangeConfigurationParams
import org.eclipse.lsp4j.DidChangeWatchedFilesParams
import org.eclipse.lsp4j.services.LanguageServer
import org.eclipse.lsp4j.services.WorkspaceService

class SarifWorkspaceService(val server: LanguageServer): WorkspaceService {
    companion object {
        private val logger = LogManager.getLogger(SarifWorkspaceService::class.java)
    }

    override fun didChangeConfiguration(params: DidChangeConfigurationParams?) {
        logger.info("workspace/didChangeConfiguration")
    }

    override fun didChangeWatchedFiles(params: DidChangeWatchedFilesParams?) {
        logger.info("workspace/didChangeWatchedFiles")
    }
}