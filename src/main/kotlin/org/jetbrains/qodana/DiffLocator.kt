package org.jetbrains.qodana

import com.github.difflib.DiffUtils
import com.github.difflib.patch.DeltaType
import com.github.difflib.text.DiffRowGenerator


class DiffLocator {
    companion object {
        private val rgx = "\\R".toRegex()
        private const val RMV = '\u00A0'
        private const val ADD = '\u200C'
        private val generator = DiffRowGenerator.create()
            .showInlineDiffs(true)
            .mergeOriginalRevised(true)
            .inlineDiffByWord(true)
            .oldTag { _: Boolean? -> RMV.toString() }
            .newTag { _: Boolean? -> ADD.toString() }
            .build()

        fun computeFirstLine(input: String) = input.split(rgx).firstOrNull()
        fun computeLineDiff(before: String, after: String, columns: List<Int>): List<DiffResult> {
            if (columns.any { it >= before.length }) return emptyList() // safety check
            val rows = generator.generateDiffRows(
                mutableListOf(before),
                mutableListOf(after)
            )
            val row = rows.first()
            val array = mutableListOf<Int?>()
            for (i in before.indices) {
                array.add(i, null)
            }
            var oldIdx = 0
            var newIdx = 0
            var inRemove = false
            var inAdd = false
            var i = 0
            while (i < row.oldLine.length && oldIdx < before.length) {
                val char = row.oldLine[i]
                when (char) {
                    RMV -> {
                        if (inAdd) return emptyList() // problem while comparison
                        inRemove = !inRemove
                    }
                    ADD -> {
                        if (inRemove) return emptyList() // problem while comparison
                        inAdd = !inAdd
                    }
                    else -> {
                        if (inRemove) {
                            oldIdx++
                        } else if (inAdd) {
                            newIdx++
                        } else {
                            array[oldIdx] = newIdx
                            newIdx++
                            oldIdx++
                        }
                    }
                }
                i++
            }

            return columns.map {
                DiffResult(it, array[it], if(array[it] != null) DiffStatus.CHANGE else DiffStatus.DELETE)
            }.toList()
        }

        fun computeDiff(before: String, actual: String, lines: List<Int>): List<DiffResult> {
            val original = before.split(rgx)
            val revised = actual.split(rgx)
            return computeDiff(original, revised, lines).map {
                if (it.status != DiffStatus.DELETE && it.newIdx != null) {
                    DiffResult(it.idx, it.newIdx, it.status, original[it.idx], revised[it.newIdx])
                } else {
                    it
                }
            }
        }

        fun computeDiff(original: List<String>, revised: List<String>, lines: List<Int>): List<DiffResult> {
            val patch = DiffUtils.diff(original.map { it.replace(" ","") }, revised.map { it.replace(" ","") })

            val mapping = mutableListOf<Int?>()
            for (i in original.indices) {
                mapping.add(i, i)
            }

            val deltas = patch.deltas
            // Process the deltas starting from the last one
            deltas.reverse()

            for (delta in deltas) {
                val oldLinePosition: Int = delta.source.position
                val oldLineCount: Int = delta.source.size()
                when (delta.type!!) {
                    DeltaType.DELETE -> {
                        // If lines were deleted, we remove them from the mapping
                        for (i in 0..<oldLineCount) {
                            mapping.removeAt(oldLinePosition)
                        }
                    }

                    DeltaType.INSERT -> {
                        // If lines were inserted, we add placeholders in the mapping
                        val lineCountInRevised: Int = delta.target.size()
                        for (i in 0..<lineCountInRevised) {
                            mapping.add(oldLinePosition + i, null)
                        }
                    }

                    DeltaType.CHANGE -> {
                        // If lines were changed, we need to consider the number of new lines added
                        val deltaCount = delta.target.size() - oldLineCount
                        // If lines have been added in the change
                        if (deltaCount > 0) {
                            for (i in 0..<deltaCount) {
                                mapping.add(oldLinePosition + i, null)
                            }
                        }
                    }
                    DeltaType.EQUAL -> { }
                }
            }

            val ret = mutableListOf<DiffResult>()
            for (line in lines) {
                val idx = mapping.indexOf(line)
                if (idx == -1) {
                    ret.add(DiffResult(line, -1, DiffStatus.DELETE))
                } else {
                    ret.add(DiffResult(line, idx, DiffStatus.CHANGE))
                }
            }
            return ret
        }
    }
}

enum class DiffStatus {
    CHANGE,
    DELETE
}

data class DiffResult(val idx: Int, val newIdx: Int?, val status: DiffStatus, val str: String? = null, val newStr: String? = null)