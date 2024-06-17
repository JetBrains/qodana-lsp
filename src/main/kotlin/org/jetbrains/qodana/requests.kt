package org.jetbrains.qodana

import com.google.gson.JsonParser
import com.google.gson.stream.JsonReader
import com.jetbrains.qodana.sarif.model.Result
import com.jetbrains.qodana.sarif.SarifUtil
import com.jetbrains.qodana.sarif.model.Level
import org.apache.logging.log4j.LogManager
import org.apache.logging.log4j.Logger
import org.eclipse.lsp4j.*
import org.jetbrains.qodana.Utils.findGitRepositoryFolder
import org.jetbrains.qodana.Utils.getRelativePath
import org.jetbrains.qodana.Utils.lineColToOffset
import java.io.File
import java.io.FileNotFoundException
import java.io.FileReader
import java.net.URL
import java.nio.file.Path
import java.nio.file.Paths
import java.util.concurrent.ConcurrentHashMap
import kotlin.io.path.exists
import kotlin.text.StringBuilder

val logger: Logger = LogManager.getLogger(SarifLanguageServer::class.java)

interface IRequest {
    suspend fun execute(state: SarifLanguageServer.ServerState)
}

class SourceLocation(private val path: String): IRequest {
    override suspend fun execute(state: SarifLanguageServer.ServerState) {
        state.pathPrefix = Path.of(path).toAbsolutePath()
        state.repoFolder = findGitRepositoryFolder(path)?.toPath()
        logger.info("sources location set {$path}")
    }
}


class SarifFile(private val path: String, private val showBaselineIssues: Boolean): IRequest {
    override suspend fun execute(state: SarifLanguageServer.ServerState) {
        if (!File(path).exists()) {
            logger.error("sarif report doesn't exist at {$path}")
            return
        }
        val pathPrefix = state.pathPrefix
        if (pathPrefix == null) {
            logger.error("path prefix not set at the moment of reading the report")
            return
        }
        state.sarifLocation = path
        val diags = computeDiagnosticsAsIs(showBaselineIssues)
        val oldFiles = state.diagnostic?.keys ?: emptyList()
        state.diagnostic = diags.toMap(ConcurrentHashMap())
        state.repositoryFileCache = ConcurrentHashMap()
        state.sarifRevision = lazy { getRevisionId(path) }
        state.gitLocator?.value?.close()
        state.gitLocator = lazy {
            val revision = state.sarifRevision?.value
            if (revision != null && state.repoFolder != null) {
                GitLocator.create(state.repoFolder, revision)
            } else {
                null
            }
        }
        // check path prefix
        val exists = diags.keys.any { pathPrefix.resolve(it).exists() }
        if (!exists && diags.any()) {
           // we have a problem, since the suffix for the folder was wrong. let's try to recover
           val prefix = pathPrefix.toFile()
               .listFiles { f -> f.isDirectory }
               ?.map { d -> d.toPath() }
               ?.firstOrNull { p -> diags.keys.any { p.resolve(it).exists() } }
           if (prefix != null) {
               logger.warn("Prefix reassigned from ${state.pathPrefix} to $prefix")
               state.pathPrefix = prefix
           } else {
               logger.error("Supplied prefix doesn't match any files in the report.")
           }
        }

        // we need to invalidate old diagnostics if any
        for (file in oldFiles) {
            state.requestChannel.send(AnnounceDiagnostics(file, emptyList()))
        }

        for ((file, value) in diags) {
            state.requestChannel.send(AnnounceDiagnostics(file, value))
        }
        // we may have already some opened files at that moment. we need them to be remappable
        for (openFile in state.openFileCache.keys) {
            state.requestChannel.send(LoadRepoVersionForFile(openFile))
            state.requestChannel.send(RemapDiagnostics(openFile))
        }
    }

    private fun computeDiagnosticsAsIs(showBaselineIssues: Boolean): MutableMap<String, MutableList<DiagnosticWithHighlight>> {
        val diags = mutableMapOf<String, MutableList<DiagnosticWithHighlight>>()
        val filterBaselineState = if (showBaselineIssues) BaselineAllIssues else BaselineOnlyNewIssues
        for (problem in getProblems(path)) {
            if (problem.baselineState != null && !filterBaselineState.contains(problem.baselineState.value().lowercase())) continue
            if (problem.locations != null && problem.locations.isNotEmpty()) {
                val location = problem.locations[0]
                val locationUri = location.physicalLocation?.artifactLocation?.uri
                val region = location.physicalLocation?.region
                if (locationUri != null && region != null) {
                    val text = region.snippet?.text ?: continue
                    val severity = when (problem.level) {
                        Level.WARNING -> DiagnosticSeverity.Warning
                        Level.ERROR -> DiagnosticSeverity.Error
                        Level.NOTE -> DiagnosticSeverity.Information
                        else -> continue
                    }
                    val diagnostic = DiagnosticWithHighlight(
                        Range(
                            Position(region.startLine - 1, region.startColumn - 1),
                            Position(region.startLine - 1, region.startColumn + region.charLength - 1)
                        ),
                        problem.message.text,
                        severity,  // Or Warning, Information, Hint depending on result.level
                        "Qodana".intern(),  // Your server's name or id
                        problem.ruleId,   // The error's code if provided in the SARIF result
                        text
                    )
                    diags.getOrPut(locationUri) { mutableListOf() }.add(diagnostic)
                }
            }
        }
        return diags
    }
}

class AnnounceDiagnostics(private val localUri: String, private val diags: List<Diagnostic>): IRequest {
    override suspend fun execute(state: SarifLanguageServer.ServerState) {
        val pathPrefix = state.pathPrefix
        if (pathPrefix == null) {
            logger.error("path prefix for sarif not set")
            return
        }

        val newUri = pathPrefix.resolve(localUri).toUri().toString() // TODO: move to diag array
        state.languageClient?.publishDiagnostics(PublishDiagnosticsParams(newUri, diags))
    }
}

class RemapDiagnostics(private val uri: String): IRequest {
    override suspend fun execute(state: SarifLanguageServer.ServerState) {
        val pathPrefix = state.pathPrefix
        if (pathPrefix == null) {
            logger.error("Path prefix for the project was not set")
            return
        }
        val actual = state.openFileCache[uri]
        if (actual == null) {
            logger.error("Trying to remap diagnostics for closed file")
            return
        }
        val base = state.repositoryFileCache?.get(uri) ?: return
        val relPathToFile = getRelativePath(uri, pathPrefix) ?: return
        val diagnostics = state.diagnostic?.get(relPathToFile) ?: emptyList()
        if (!diagnostics.any()) return // nothing to remap
        val diffs = DiffLocator.computeDiff(base, actual, diagnostics.map { it.range.start.line })
        val announce = mutableListOf<Diagnostic>()
        for (diagnostic in diagnostics) {
            val oldLine = diagnostic.range.start.line
            val length = diagnostic.range.end.character - diagnostic.range.start.character // we don't compute lines in initial pass
            val matchingDiff = diffs.firstOrNull { it.idx == oldLine && it.status != DiffStatus.DELETE && it.newIdx != null } ?: continue // diagnostics got removed
            val newLine = matchingDiff.newIdx ?: continue
            val oldString = matchingDiff.str ?: continue
            val newString = matchingDiff.newStr ?: continue
            val oldColumn = diagnostic.range.start.character
            if (matchingDiff.str == matchingDiff.newStr) {
                announce.add(Diagnostic(
                    Range(
                        Position(newLine, oldColumn),
                        Position(newLine, oldColumn + length)
                    ),
                    diagnostic.message.intern(),
                    diagnostic.severity,
                    diagnostic.source,
                    diagnostic.code.left.intern()
                ))
            } else {
                val firstLineHighlight = DiffLocator.computeFirstLine(diagnostic.highlightedText)
                if (firstLineHighlight != null && !newString.contains(firstLineHighlight)) continue
                val inlineDiff = DiffLocator.computeLineDiff(
                    oldString,
                    newString,
                    listOf(oldColumn)
                )
                val matchingInlineDiff =
                    inlineDiff.firstOrNull { it.idx == oldColumn && it.newIdx != null }
                val newColumn = matchingInlineDiff?.newIdx ?: continue

                announce.add(
                    Diagnostic(
                        Range(
                            Position(newLine, newColumn),
                            Position(newLine, newColumn + length)
                        ),
                        diagnostic.message.intern(),
                        diagnostic.severity,
                        diagnostic.source,
                        diagnostic.code.left.intern()
                    )
                )
            }
        }
        state.languageClient?.publishDiagnostics(PublishDiagnosticsParams(uri, announce))
    }
}

class LoadRepoVersionForFile(private val uri: String): IRequest {
    override suspend fun execute(state: SarifLanguageServer.ServerState) {
        if (!state.openFileCache.containsKey(uri)) return // we no longer need this file
        val locator = state.gitLocator?.value
        val repoFolder = state.repoFolder
        if (locator == null || repoFolder == null) {
            logger.warn("Repo for $uri in folder $repoFolder having revision ${state.sarifRevision}")
            return
        }
        var analyzedVersion: String? = null
        // we need to iterate both repo folder and path prefix to support submodules
        for (folder in listOfNotNull(repoFolder, state.pathPrefix)) {
            val relPathToFile = getRelativePath(uri, folder) ?: continue
            analyzedVersion = locator.retrieveFile(relPathToFile)
            if (analyzedVersion != null) break
        }
        if (analyzedVersion == null) {
            logger.error("Failed to get file ${getRelativePath(uri, repoFolder)} for ${state.sarifRevision} in ${state.repoFolder}")
            return
        }
        state.repositoryFileCache?.put(uri, analyzedVersion)
    }
}

class OpenFile(private val uri: String, private val text: String): IRequest {
    override suspend fun execute(state: SarifLanguageServer.ServerState) {
        state.openFileCache[uri] = text
        LoadRepoVersionForFile(uri).execute(state) // do this immediately
    }
}

class UpdateFile(private val uri: String, private val changes: List<TextDocumentContentChangeEvent>): IRequest {
    override suspend fun execute(state: SarifLanguageServer.ServerState) {
        if (!state.openFileCache.containsKey(uri)) {
            logger.error("File $uri is missing in the cache, asking to open it")
            OpenFile(uri, Paths.get(URL(uri).toURI()).toFile().readText()).execute(state) // executing in place
        }
        val document = state.openFileCache[uri]
        val sb = StringBuilder(document)
        if (!(changes.size == 1 && changes[0].range == null)) {
            for (change in changes) {
                val start = lineColToOffset(sb, change.range.start.line, change.range.start.character)
                val end = lineColToOffset(sb, change.range.end.line, change.range.end.character)
                sb.replace(start, end, change.text)
            }
            state.openFileCache[uri] = sb.toString()
        } else {
            state.openFileCache[uri] = changes[0].text
        }
    }
}

class CloseFile(private val uri: String): IRequest {
    override suspend fun execute(state: SarifLanguageServer.ServerState) {
        state.openFileCache.remove(uri)
        state.repositoryFileCache?.remove(uri)
    }
}

class CloseReport : IRequest {
    override suspend fun execute(state: SarifLanguageServer.ServerState) {
        val oldFiles = state.diagnostic?.keys ?: emptyList()
        state.diagnostic = null
        for (file in oldFiles) {
            state.requestChannel.send(AnnounceDiagnostics(file, emptyList()))
        }
    }
}


fun getProblems(sarifPath: String): Sequence<Result> = sequence {
    FileReader(sarifPath).use { fileReader ->
        for (indexedResult in SarifUtil.lazyReadIndexedResults(fileReader)) {
            yield(indexedResult.result)
        }
    }
}

fun getRevisionId(sarifPath: String): String? {
    return try {
        val reader = JsonReader(FileReader(sarifPath))
        val jsonObject = JsonParser.parseReader(reader).asJsonObject
        val runsArray = jsonObject.getAsJsonArray("runs")

        if (runsArray.size() == 0) return null

        val runObject = runsArray[0].asJsonObject
        val versionControlArray = runObject.getAsJsonArray("versionControlProvenance")

        if (versionControlArray.size() == 0) return null

        versionControlArray[0].asJsonObject.get("revisionId")?.asString
    } catch (e: FileNotFoundException) {
        logger.error("File not found: ${e.localizedMessage}")
        null
    } catch (e: Exception) {
        logger.error("Failed to parse JSON: ${e.localizedMessage}")
        null
    }
}
