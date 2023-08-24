package org.jetbrains.qodana

import org.eclipse.lsp4j.launch.LSPLauncher.Builder
import org.eclipse.lsp4j.services.LanguageClient

class SarifLanguageServerLauncher {
    companion object {
        @JvmStatic
        fun main(args: Array<String>) {
            val server = SarifLanguageServer()
            val launcher = Builder<LanguageClient>()
                .setLocalService(server)
                .setRemoteInterface(LanguageClient::class.java)
                .setInput(System.`in`)
                .setOutput(System.out)
                .create()
            val client = launcher.remoteProxy
            server.connect(client)
            launcher.startListening().get()
        }
    }
}