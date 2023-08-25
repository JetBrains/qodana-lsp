package org.jetbrains.qodana

import org.eclipse.jgit.api.Git
import org.eclipse.jgit.api.errors.GitAPIException
import org.eclipse.jgit.lib.Repository
import org.eclipse.jgit.revwalk.RevTree
import org.eclipse.jgit.revwalk.RevWalk
import org.eclipse.jgit.treewalk.TreeWalk
import org.eclipse.jgit.treewalk.filter.PathFilter
import java.io.IOException
import java.nio.file.Path

class GitLocator private constructor(private val repo: Repository, private val revWalk: RevWalk, private val tree: RevTree) {
    companion object {
        fun create(repoPath: Path?, commitHash: String?): GitLocator? {
            if (repoPath == null || commitHash == null) return null
            return create(repoPath.toString(), commitHash)
        }

        fun create(repoPath: String, commitHash: String): GitLocator? {
            return try {
                val gitInPath = Path.of(repoPath).resolve(".git").toFile()
                val repoFile = if (!gitInPath.exists()) {
                    // case of submodules we will try to regard it as a repo folder
                    Path.of(repoPath).toFile()
                } else {
                    gitInPath
                }
                if (!repoFile.exists()) return null // repo doesn't exist
                val git = Git.open(repoFile)
                val repo = git.repository
                val revWalk = RevWalk(repo)
                val commitId = repo.resolve(commitHash) ?: return null // need to fetch the revision
                val commit = revWalk.parseCommit(commitId)
                GitLocator(repo, revWalk, commit.tree)
            } catch (e: IOException) {
                null
            } catch (e: GitAPIException) {
                null
            }
        }
    }

    fun retrieveFile(path: String): String? {
        TreeWalk(repo).use { treeWalk ->
            treeWalk.addTree(tree)
            treeWalk.isRecursive = true
            treeWalk.filter = PathFilter.create(path)
            if (!treeWalk.next()) return null
            val objectId = treeWalk.getObjectId(0)
            val loader = repo.open(objectId)

            // Load the content of the file into a String
            return String(loader.bytes)
        }
    }

    fun close() {
        revWalk.close()
        repo.close()
    }
}