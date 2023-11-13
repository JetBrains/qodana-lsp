package org.jetbrains.qodana

import kotlinx.coroutines.future.await
import kotlinx.coroutines.launch
import kotlinx.coroutines.yield
import org.eclipse.lsp4j.*
import org.eclipse.lsp4j.jsonrpc.Launcher
import org.eclipse.lsp4j.services.LanguageClient
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import java.nio.file.Paths
import java.util.concurrent.CompletableFuture
import java.util.concurrent.TimeUnit

class SarifLanguageServerTest {
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
    }

    @Test
    fun testFullCycle() {
        val feature = CompletableFuture<Unit>()
        server.state.scope.launch {
            server.setSourceLocation(SetSourceLocationParams(Paths.get("src/test/resources/sources").toString())).await()
            server.setSarifFile(SetSarifFileParams(Paths.get("src/test/resources/sarif/qodana.sarif.json").toString(), true)).await()
            while (client.diagnostics.size != 11) yield()
            server.state.requestChannel.send(object : IRequest {
                override suspend fun execute(state: SarifLanguageServer.ServerState) {
                    feature.complete(Unit)
                }
            })
        }
        feature.get(10, TimeUnit.SECONDS)

        val diagnostics = client.diagnostics
        assertEquals(11, diagnostics.size)
        val file = Paths.get("src/test/resources/sources/DFAchecks.cpp").toUri().toString()
        val diagsInFile = diagnostics[file]!!.toList()
        assertEquals(18, diagsInFile.size)
        client.diagnostics.clear()

        // now we are going to remove 2 checks
        val feature2 = CompletableFuture<Unit>()
        server.state.scope.launch {
            server.textDocumentService.didChange(DidChangeTextDocumentParams(
                VersionedTextDocumentIdentifier(file,2),
                listOf(TextDocumentContentChangeEvent(Range(Position(250,0), Position(255,1)), ""))
            ))
            while (client.diagnostics.size != 1) yield()
            server.state.requestChannel.send(object : IRequest {
                override suspend fun execute(state: SarifLanguageServer.ServerState) {
                    feature2.complete(Unit)
                }
            })
        }
        feature2.get(10, TimeUnit.SECONDS)
        val newDiagsInFile = diagnostics[file]!!.toList()
        assertEquals(16, newDiagsInFile.size)
    }

    @Test
    fun testNonBaselineIssues() {
        val feature = CompletableFuture<Unit>()
        server.state.scope.launch {
            server.setSourceLocation(SetSourceLocationParams(Paths.get("src/test/resources/sources").toString()))
                .await()
            server.setSarifFile(
                SetSarifFileParams(
                    Paths.get("src/test/resources/sarif/qodana.sarif.json").toString(),
                    false
                )
            ).await()
            while (client.diagnostics.size != 11) yield()
            server.state.requestChannel.send(object : IRequest {
                override suspend fun execute(state: SarifLanguageServer.ServerState) {
                    feature.complete(Unit)
                }
            })
        }
        feature.get(10, TimeUnit.SECONDS)

        val diagnostics = client.diagnostics
        assertEquals(11, diagnostics.size)
        val file = Paths.get("src/test/resources/sources/DFAchecks.cpp").toUri().toString()
        val diagsInFile = diagnostics[file]!!.toList()
        assertEquals(17, diagsInFile.size)
        client.diagnostics.clear()
    }
}