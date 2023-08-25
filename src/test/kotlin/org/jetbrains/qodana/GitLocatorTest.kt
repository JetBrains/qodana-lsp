package org.jetbrains.qodana

import org.junit.jupiter.api.Test
import kotlin.test.assertNotEquals
import kotlin.test.assertNotNull

class GitLocatorTest {
    @Test
    fun locateVersion() {
        val versions = listOf("dcbc07ba", "be0cb6f9", "f3b981ea", "f0636a03")
        var text = ""
        for (version in versions) {
            val locator = GitLocator.create(repoPath, version)
            assertNotNull(locator)
            val txt = locator.retrieveFile("src/test/resources/gitlocator/text.txt")
            assertNotNull(txt)
            assertNotEquals(text, txt)
            text = txt
        }
    }
}