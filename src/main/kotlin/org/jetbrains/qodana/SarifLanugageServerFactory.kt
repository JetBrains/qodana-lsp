package org.jetbrains.qodana

import org.eclipse.lsp4j.jsonrpc.Launcher
import org.eclipse.lsp4j.launch.LSPLauncher
import org.eclipse.lsp4j.services.LanguageClient
import java.net.Socket

interface ServerLauncher {
    fun build(): Launcher<LanguageClient>
}

class StdIOLauncher(private val server: SarifLanguageServer) : ServerLauncher {
    override fun build(): Launcher<LanguageClient> {
        val launcher = LSPLauncher.Builder<LanguageClient>()
            .setLocalService(server)
            .setRemoteInterface(LanguageClient::class.java)
            .setInput(System.`in`)
            .setOutput(System.out)
            .create()
        val client = launcher.remoteProxy
        server.connect(client)
        return launcher
    }

    override fun toString(): String {
        return "StdIOLauncher"
    }
}

// TCP Launcher now takes a port and IP address as input
class TcpLauncher(private val server: SarifLanguageServer, private val ipAddress: String, private val port: Int) : ServerLauncher {
    override fun build(): Launcher<LanguageClient> {
        val socket = Socket(ipAddress, port)
        val launcher = LSPLauncher.Builder<LanguageClient>()
            .setLocalService(server)
            .setRemoteInterface(LanguageClient::class.java)
            .setInput(socket.getInputStream())
            .setOutput(socket.getOutputStream())
            .create()
        val client = launcher.remoteProxy
        server.connect(client)
        return launcher
    }
    override fun toString(): String {
        return "TcpLauncher - IP: $ipAddress, Port: $port"
    }
}

enum class LauncherType {
    STDIO, TCP
}

// Updated Factory class
class LauncherFactory {
    companion object {
        fun createLauncher(type: LauncherType, server: SarifLanguageServer = SarifLanguageServer(), ipAddress: String = "", port: Int = 0): ServerLauncher {
            return when (type) {
                LauncherType.STDIO -> StdIOLauncher(server)
                LauncherType.TCP -> TcpLauncher(server, ipAddress, port)
            }
        }
    }
}