import { diffWordsWithSpace, Change } from "diff";

export interface DiffSummary {
  added_words: number;
  removed_words: number;
  unchanged_words: number;
  changes: Change[];
}

/**
 * Compute a word-level diff between two text snapshots.
 * Returns structured change info suitable for timeline display and replay.
 */
export function computeDiff(before: string, after: string): DiffSummary {
  const changes = diffWordsWithSpace(before, after);

  let added_words = 0;
  let removed_words = 0;
  let unchanged_words = 0;

  for (const change of changes) {
    const wordCount = change.value.trim().split(/\s+/).filter(Boolean).length;
    if (change.added)        added_words    += wordCount;
    else if (change.removed) removed_words  += wordCount;
    else                     unchanged_words += wordCount;
  }

  return { added_words, removed_words, unchanged_words, changes };
}

/**
 * Lightweight stats-only diff (no change array) — used for timeline metadata.
 */
export function diffStats(
  before: string,
  after: string
): Omit<DiffSummary, "changes"> {
  const { added_words, removed_words, unchanged_words } = computeDiff(
    before,
    after
  );
  return { added_words, removed_words, unchanged_words };
}
