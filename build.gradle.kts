plugins {
    kotlin("jvm") version "1.9.10"
    id("com.github.johnrengelman.shadow") version "8.1.1"
    application
}

group = "org.jetbrains.qodana"
version = "1.0-SNAPSHOT"
val qodanaSarifVersion = "0.2.8"
val lsp4jVersion = "0.21.0"
val log4jVersion = "2.17.1"
val jgitVersion = "5.13.0.202109080827-r"
val diffUtilsVersion = "4.12"
val kotlinxCoroutineVersion = "1.7.2"

repositories {
    mavenCentral()
    maven("https://cache-redirector.jetbrains.com/intellij-dependencies")
}

dependencies {
    testImplementation(kotlin("test"))
    implementation("org.slf4j:slf4j-nop:1.7.25")
    implementation("org.eclipse.lsp4j:org.eclipse.lsp4j:$lsp4jVersion")
    implementation("com.jetbrains.qodana:qodana-sarif:$qodanaSarifVersion")
    implementation("org.apache.logging.log4j:log4j-api:$log4jVersion")
    implementation("org.apache.logging.log4j:log4j-core:$log4jVersion")
    implementation("org.eclipse.jgit:org.eclipse.jgit:$jgitVersion")
    implementation("io.github.java-diff-utils:java-diff-utils-jgit:$diffUtilsVersion")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:$kotlinxCoroutineVersion")
}

tasks {
    shadowJar {
        archiveBaseName.set("sarif-lsp")
        archiveVersion.set("1.0.1")
        archiveClassifier.set("")
        destinationDirectory.set(file("vscode/qodana/lib"))
        manifest.attributes["Multi-Release"] = "true"
    }
}

tasks.test {
    useJUnitPlatform()
}

kotlin {
    jvmToolchain(11)
}

application {
    mainClass.set("org.jetbrains.qodana.SarifLanguageServerLauncher")
}