import org.apache.logging.log4j.LogManager
import org.eclipse.lsp4j.DidChangeTextDocumentParams
import org.eclipse.lsp4j.DidCloseTextDocumentParams
import org.eclipse.lsp4j.DidOpenTextDocumentParams
import org.eclipse.lsp4j.DidSaveTextDocumentParams
import org.eclipse.lsp4j.services.LanguageServer
import org.eclipse.lsp4j.services.TextDocumentService

class SarifTextDocumentService(val server: LanguageServer) : TextDocumentService {
    companion object {
        private val logger = LogManager.getLogger(SarifTextDocumentService::class.java)
    }

    override fun didOpen(params: DidOpenTextDocumentParams?) {
        logger.info("text/didOpen {fileUri: '${params?.textDocument?.uri}'}")
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