plugins {
    kotlin("jvm") version "1.9.0"
    id("com.github.johnrengelman.shadow") version "8.1.1"
    application
}

group = "org.jetbrains.qodana"
version = "1.0-SNAPSHOT"
val qodanaSarifVersion = "0.2.8"
val lsp4jVersion = "0.21.0"
val log4jVersion = "2.17.1"

repositories {
    mavenCentral()
    maven("https://cache-redirector.jetbrains.com/intellij-dependencies")
}

dependencies {
    testImplementation(kotlin("test"))
    implementation("org.eclipse.lsp4j:org.eclipse.lsp4j:$lsp4jVersion")
    implementation("com.jetbrains.qodana:qodana-sarif:$qodanaSarifVersion")
    implementation("org.apache.logging.log4j:log4j-api:$log4jVersion")
    implementation("org.apache.logging.log4j:log4j-core:$log4jVersion")
}

tasks {
    shadowJar {
        archiveBaseName.set("sarif-lsp")
        archiveVersion.set("0.1.0")
        archiveClassifier.set("")
        destinationDirectory.set(file("lib"))
        manifest.attributes["Multi-Release"] = "true"
    }
}

tasks.test {
    useJUnitPlatform()
}

kotlin {
    jvmToolchain(17)
}

application {
    mainClass.set("org.jetbrains.qodana.SarifLanguageServerLauncher")
}