package org.jetbrains.qodana

import org.eclipse.lsp4j.Diagnostic
import org.eclipse.lsp4j.DidOpenTextDocumentParams
import org.eclipse.lsp4j.TextDocumentItem
import org.eclipse.lsp4j.jsonrpc.Launcher
import org.eclipse.lsp4j.services.LanguageClient
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import java.nio.file.Paths
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class SarifLanguageServerTest {
    private val executorService: ExecutorService = Executors.newSingleThreadExecutor()
    private lateinit var client: SarifTestLanguageClient
    private lateinit var server: SarifLanguageServer
    private lateinit var launcher: Launcher<LanguageClient>

    @BeforeEach
    fun setup() {
        server = SarifLanguageServer()
        client = SarifTestLanguageClient()

        launcher = LauncherFactory.createLauncher(LauncherType.STDIO, server).build()
        launcher.startListening()

        server.connect(client)
    }

    @AfterEach
    fun tearDown() {
        server.shutdown()
        executorService.shutdown()
    }

    @Test
    fun testDidOpen() {
        val uri = Paths.get("src/test/resources/testFile.txt").toUri().toString()

        // Pretend to open a file
        val openParams = DidOpenTextDocumentParams().apply {
            textDocument = TextDocumentItem().apply {
                this.uri = uri
                this.languageId = "plaintext"
                this.version = 0
                this.text = "initial text"
            }
        }
        server.textDocumentService.didOpen(openParams)

        // Get the diagnostics produced by the server in the didOpen method
        val diagnostics = client.diagnostics.toList()

        // Check the diagnostics
        assertEquals(diagnostics, emptyList<Diagnostic>())
    }
}