job("Build and Publish") {
    startOn {
        gitPush {
            anyBranchMatching {
                +"main"
            }
            enabled = true
        }
    }

    git {
        // Pulling up the entire history to for running the tests
        refSpec {
            +"refs/heads/*:refs/heads/*"
            +"refs/tags/*:refs/tags/*"
        }
        depth = UNLIMITED_DEPTH
    }

    kaniko("Build build container") {
        resources {
            cpu = 4.cpu
            memory = 16.gb
        }

        build {
            dockerfile = "./Dockerfile"
        }

        push("registry.jetbrains.team/p/sa/containers/qodana-lsp-builder") {
            tags("\$JB_SPACE_GIT_REVISION")
        }
    }

    parallel {
        sequential {
            host("Run build") {
                env["QODANA_TOKEN_JS"] = "{{ project:qodana-lsp-js }}"
                env["QODANA_TOKEN_JVM"] = "{{ project:qodana-lsp-java }}"
                shellScript {
                    content = """
                    docker run --rm --env BUILDNUM=${'$'}JB_SPACE_EXECUTION_NUMBER -v ${'$'}JB_SPACE_WORK_DIR_PATH/:/usr/src/qodana/ --entrypoint=./build.sh registry.jetbrains.team/p/sa/containers/qodana-lsp-builder:${"$"}JB_SPACE_GIT_REVISION
                    rm -rf vscode/qodana/.vscode-test
                    docker run --rm --env QODANA_TOKEN=${'$'}QODANA_TOKEN_JS -v ${'$'}JB_SPACE_WORK_DIR_PATH/:/data/project/ jetbrains/qodana-js:2023.2 --source-dir vscode/qodana
                    docker run --rm --env QODANA_TOKEN=${'$'}QODANA_TOKEN_JVM -v ${'$'}JB_SPACE_WORK_DIR_PATH/:/data/project/ jetbrains/qodana-jvm:2023.2
                """.trimIndent()
                }
                fileArtifacts {
                    // Local path to artifact relative to working dir
                    localPath = "vscode/qodana/qodana-cloud-plugin.vsix"
                    // Don't fail job if build.zip is not found
                    optional = false
                    // Target path to artifact in file repository.
                    remotePath = "{{ run:number }}/qodana-lsp.vsix"
                    // Upload condition (job run result): SUCCESS (default), ERROR, ALWAYS
                    onStatus = OnStatus.SUCCESS
                }
            }
        }
    }
}