package org.jetbrains.qodana

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

class DiffLocatorTest {
    private val testLines = listOf(0, 1, 2, 3)
    private val line1 = "abcd"
    private val line2 = "efgh"
    private val line3 = "ijkl"
    private val line4 = "mnop"

    @Test
    fun newLineChange() {
        val locator = DiffLocator.computeDiff(listOf(line1, line2, line3, line4), listOf(line1, "dsfs", "dsfs", " $line2", "dsfs", line3, line4), testLines)
        assertEquals(listOf(
            DiffResult(0,0, DiffStatus.CHANGE),
            DiffResult(1, 3, DiffStatus.CHANGE),
            DiffResult(2, 5, DiffStatus.CHANGE),
            DiffResult(3, 6, DiffStatus.CHANGE)), locator)
    }

    @Test
    fun noChange() {
        val locator = DiffLocator.computeDiff(listOf(line1, line2, line3, line4), listOf(line1, line2, line3, line4), testLines)
        assertEquals(listOf(
            DiffResult(0,0, DiffStatus.CHANGE),
            DiffResult(1, 1, DiffStatus.CHANGE),
            DiffResult(2, 2, DiffStatus.CHANGE),
            DiffResult(3, 3, DiffStatus.CHANGE)), locator)
    }

    @Test
    fun allRemoved() {
        val locator = DiffLocator.computeDiff(listOf(line1, line2, line3, line4), emptyList(), testLines)
        assertEquals(listOf(
            DiffResult(0,-1, DiffStatus.DELETE),
            DiffResult(1, -1, DiffStatus.DELETE),
            DiffResult(2, -1, DiffStatus.DELETE),
            DiffResult(3, -1, DiffStatus.DELETE)), locator)
    }

    @Test
    fun allAdded() { // unreal scenario
        val locator = DiffLocator.computeDiff(emptyList(), listOf(line1, line2, line3, line4), testLines)
        assertEquals(listOf(
            DiffResult(0,-1, DiffStatus.DELETE),
            DiffResult(1, -1, DiffStatus.DELETE),
            DiffResult(2, -1, DiffStatus.DELETE),
            DiffResult(3, -1, DiffStatus.DELETE)), locator)
    }

    @Test
    fun oneRemoved() {
        val locator = DiffLocator.computeDiff(listOf(line1, line2, line3, line4), listOf(line1, line3, line4), testLines)
        assertEquals(listOf(
            DiffResult(0,0, DiffStatus.CHANGE),
            DiffResult(1, -1, DiffStatus.DELETE),
            DiffResult(2, 1, DiffStatus.CHANGE),
            DiffResult(3, 2, DiffStatus.CHANGE)), locator)
    }

    @Test
    fun newLine() {
        val locator = DiffLocator.computeDiff(listOf(line1, line2, line4), listOf(line1, line2, line3, line4), listOf(0, 1, 2))
        assertEquals(listOf(
            DiffResult(0,0, DiffStatus.CHANGE),
            DiffResult(1, 1, DiffStatus.CHANGE),
            DiffResult(2, 3, DiffStatus.CHANGE)), locator)
    }

    @Test
    fun changedWithinLine() {
        val locator = DiffLocator.computeDiff(listOf(line1, line2, line3, line4), listOf(line1, "$line2$%!", line3, line4), testLines)
        assertEquals(listOf(
            DiffResult(0,0, DiffStatus.CHANGE),
            DiffResult(1, 1, DiffStatus.CHANGE),
            DiffResult(2, 2, DiffStatus.CHANGE),
            DiffResult(3, 3, DiffStatus.CHANGE)), locator)
    }

    @Test
    fun changedOrder() {
        val locator = DiffLocator.computeDiff(listOf(line1, line2, line3, line4), listOf(line1, line2, line4, line3), testLines)
        assertEquals(listOf(
            DiffResult(0,0, DiffStatus.CHANGE),
            DiffResult(1, 1, DiffStatus.CHANGE),
            DiffResult(2, -1, DiffStatus.DELETE), // drawback of the algorithm
            DiffResult(3, 2, DiffStatus.CHANGE)), locator)
    }

    @Test
    fun changedOrder2() {
        val locator = DiffLocator.computeDiff(listOf(line1, line2, line3, line4, line4), listOf(line1, line2, line4, line3, line4), testLines)
        assertEquals(listOf(
            DiffResult(0,0, DiffStatus.CHANGE),
            DiffResult(1, 1, DiffStatus.CHANGE),
            DiffResult(2, 3, DiffStatus.CHANGE),
            DiffResult(3, 4, DiffStatus.CHANGE)), locator) // drawback of the algorithm
    }

    @Test
    fun manyChanges() {
        val locator = DiffLocator.computeDiff(listOf(line1, line2, line3, line4), listOf(line1, line4, "qrst"), testLines)
        assertEquals(listOf(
            DiffResult(0,0, DiffStatus.CHANGE),
            DiffResult(1, -1, DiffStatus.DELETE),
            DiffResult(2, -1, DiffStatus.DELETE),
            DiffResult(3, 1, DiffStatus.CHANGE)), locator)
    }

    @Test
    fun changesFromGit() {
        val lastId = "dcbc07baf447126dece036089d679c3ec5768781"
        val firstId = "f0636a03c86386ee582dd8f8e6f27be18ed5be5a"
        val lastTxt = GitLocator.create(repoPath, lastId)!!.retrieveFile("src/test/resources/gitlocator/text.txt")!!
        val firstTxt = GitLocator.create(repoPath, firstId)!!.retrieveFile("src/test/resources/gitlocator/text.txt")!!
        // 1 -> 4
        // 6 -> 10
        // 8 -> X
        val locator = DiffLocator.computeDiff(firstTxt, lastTxt, listOf(1, 6, 8)).map {
            DiffResult(it.idx, it.newIdx, it.status)
        }
        assertEquals(listOf(
            DiffResult(1,4, DiffStatus.CHANGE),
            DiffResult(6, 10, DiffStatus.CHANGE),
            DiffResult(8, -1, DiffStatus.DELETE)), locator)
    }

    @Test
    fun changesInLine() {
        val first = "one two three two four three"
        val second = listOf("one two three two four three",
            "one four two three two four three",
            "four two three two four three",
            "one two four three two four three",
            "one two three four three",
            "one two three two two four three",
            "two one two three two four three",
            "",
            "two")
        val result = second.map { DiffLocator.computeLineDiff(first, it, first.indices.toList()) }.toList()
        for (i in second.indices) {
            val diff = result[i]
            for (k in diff.indices) {
                val res = diff[k].newIdx
                if (res != null) {
                    assertEquals(first[k], second[i][res], "Problem while comparing $first and ${second[i]} on $i idx")
                }
            }
        }
    }
}