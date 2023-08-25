package org.jetbrains.qodana

import java.io.File
import java.net.URI
import java.nio.file.FileSystemNotFoundException
import java.nio.file.Path
import java.nio.file.Paths

object Utils {
    fun lineColToOffset(text: CharSequence, line: Int, col: Int): Int {
        var curLine = 0
        var offset = 0
        while (line != curLine) {
            if (offset == text.length) return -1
            val c = text[offset]
            if (c == '\n') {
                curLine++
            } else if (c == '\r') {
                curLine++
                if (offset < text.length - 1 && text[offset + 1] == '\n') {
                    offset++
                }
            }
            offset++
        }
        return offset + col
    }

    fun findGitRepositoryFolder(folderPath: String): File? {
        try {
            var parentFolder: File? = File(folderPath).absoluteFile
            while (parentFolder != null) {
                val gitFolder = File(parentFolder, ".git")
                if (gitFolder.exists() && gitFolder.isDirectory) {
                    return parentFolder
                } else if (gitFolder.exists() && gitFolder.isFile) {
                    // it could be submodule, in this case we need to look up the symlink
                    val lines = gitFolder.readLines()
                    for (line in lines) {
                        if (line.startsWith("gitdir: ")) {
                            val relativeGitDir = line.removePrefix("gitdir: ").trim()
                            return Paths.get(gitFolder.parentFile.absolutePath, relativeGitDir).normalize().toFile()
                        }
                    }
                    // we know that we've found nothing
                    return null
                }
                parentFolder = parentFolder.parentFile
            }
            return null
        } catch (e: Exception) {
            return null // we may get RBAC problems here
            // TODO: add reporting to the client
        }
    }

    fun getRelativePath(uri: String, basePath: Path): String? {
        return try {
            val filePath = Paths.get(URI(uri))
            basePath.relativize(filePath).toString().replace("\\","/")
        } catch (e: FileSystemNotFoundException) {
            null
        }
    }
}