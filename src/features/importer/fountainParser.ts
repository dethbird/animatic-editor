/**
 * Fountain (.fountain.ext) parser — extracts panels with media/duration/nesting.
 *
 * Ported from fountain-writer: github.com/dethbird/fountain-writer
 * frontend/src/utils/fountainParser.js → parsePanels()
 *
 * Only the panel-extraction logic is kept; HTML rendering is stripped.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface ParsedPanel {
  id: string;
  title: string;
  duration: number | null;
  durationSource: 'explicit' | 'estimated' | 'none';
  imageUrl: string | null;
  audioUrl: string | null;
  act: string | null;
  scene: string | null;
  sequence: string | null;
}

export interface FountainMeta {
  title: string | null;
  panels: ParsedPanel[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseTimeToSeconds(mmss: string): number | null {
  const parts = mmss.split(':').map((p) => parseInt(p, 10));
  if (parts.length === 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  return null;
}

function estimateDurationFromText(text: string): number {
  const words = (text || '').trim().split(/\s+/).filter(Boolean).length;
  const wordsPerSecond = 2.5; // ~150 WPM
  const seconds = words / wordsPerSecond;
  return Math.max(2, Math.min(120, Math.round(seconds)));
}

// Lightweight block classification — only the types we need for panel parsing.
type BlockType =
  | 'duration'
  | 'image'
  | 'audio'
  | 'dialogue'
  | 'action'
  | 'parenthetical'
  | 'character'
  | 'other';

interface Block {
  id: string;
  text: string;
  type: BlockType;
}

/**
 * Classify lines inside a panel body into typed blocks.
 * Only needs to identify duration, image, audio, dialogue, action,
 * parenthetical — enough to extract media and estimate duration.
 */
function classifyPanelLines(text: string): Block[] {
  const lines = text.split('\n');
  const blocks: Block[] = [];
  let characterExtended = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      characterExtended = false;
      continue;
    }

    let type: BlockType = 'action';

    if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
      characterExtended = false;
      type = 'duration';
    } else if (/^\[i\]https?:\/\/.+/i.test(trimmed)) {
      characterExtended = false;
      type = 'image';
    } else if (/^\[a\]https?:\/\/.+/i.test(trimmed)) {
      characterExtended = false;
      type = 'audio';
    } else if (
      (/^[A-Z][A-Z0-9#.'\-\s]*(\^)?$/.test(trimmed) &&
        trimmed.replace('^', '').length < 50 &&
        trimmed.length > 1) ||
      /^@.+$/.test(trimmed)
    ) {
      characterExtended = true;
      type = 'character';
    } else if (characterExtended) {
      if (/^\(.*\)$/.test(trimmed)) {
        type = 'parenthetical';
      } else {
        type = 'dialogue';
      }
    } else if (/^~ /.test(trimmed) || /^= /.test(trimmed) || /^>/.test(trimmed)) {
      characterExtended = false;
      type = 'other';
    } else {
      characterExtended = false;
      type = 'action';
    }

    blocks.push({ id: `block-${i}`, text: trimmed, type });
  }

  return blocks;
}

// ── Title page extraction ────────────────────────────────────────────────────

/**
 * Extract the `Title:` value from the fountain title page (before `===`).
 */
function extractTitle(text: string): string | null {
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // Title page ends at a page break
    if (/^={3,}$/.test(trimmed)) break;
    const m = trimmed.match(/^Title:\s*(.+)/i);
    if (m) return m[1].trim();
  }
  return null;
}

// ── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parse a `.fountain` / `.fountain.ext` document and extract panels.
 *
 * Panels are `####` headings. Each panel collects lines until the next heading
 * of any level (# through ####). Inside the panel body we look for:
 * - `mm:ss` duration lines
 * - `[i]URL` image references
 * - `[a]URL` audio references
 *
 * Act (#), Scene (##), Sequence (###) are resolved by backtracking through
 * previously-seen headings.
 */
export function parseFountain(text: string): FountainMeta {
  const title = extractTitle(text);
  const lines = (text || '').split('\n');
  const panels: ParsedPanel[] = [];

  // Pre-scan for section headings (levels 1-3) so we can determine nesting.
  const headings: { level: number; title: string; line: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const m = trimmed.match(/^(#{1,3})\s+(.*)/);
    if (m) {
      headings.push({ level: m[1].length, title: m[2].trim(), line: i });
    }
  }

  function findNearest(level: number, beforeLine: number): string | null {
    for (let k = headings.length - 1; k >= 0; k--) {
      if (headings[k].line < beforeLine && headings[k].level === level) {
        return headings[k].title;
      }
    }
    return null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!/^####\s/.test(line)) continue;

    const panelTitle = line.replace(/^####\s?/, '').trim();
    const startLine = i + 1;

    // Collect body lines until next heading of any level or another panel
    let j = i + 1;
    while (
      j < lines.length &&
      !/^#{1,3}\s/.test(lines[j].trim()) &&
      !/^####\s/.test(lines[j].trim())
    ) {
      j++;
    }

    const panelText = lines.slice(startLine, j).join('\n');
    const blocks = classifyPanelLines(panelText);

    // Extract duration
    let duration: number | null = null;
    let durationSource: 'explicit' | 'estimated' | 'none' = 'none';

    const durBlock = blocks.find((b) => b.type === 'duration');
    if (durBlock) {
      const sec = parseTimeToSeconds(durBlock.text);
      if (sec !== null) {
        duration = sec;
        durationSource = 'explicit';
      }
    }

    // Extract image and audio URLs
    const imageBlock = blocks.find((b) => b.type === 'image');
    const audioBlock = blocks.find((b) => b.type === 'audio');

    const imageUrl = imageBlock ? imageBlock.text.replace(/^\[i\]/i, '') : null;
    const audioUrl = audioBlock ? audioBlock.text.replace(/^\[a\]/i, '') : null;

    // Estimate duration from text if not explicit
    if (duration === null) {
      const rawText = blocks
        .filter((b) => b.type === 'dialogue' || b.type === 'action' || b.type === 'parenthetical')
        .map((b) => b.text)
        .join(' ');
      duration = estimateDurationFromText(rawText);
      durationSource = 'estimated';
    }

    panels.push({
      id: `panel-${panels.length + 1}`,
      title: panelTitle,
      duration,
      durationSource,
      imageUrl,
      audioUrl,
      act: findNearest(1, startLine),
      scene: findNearest(2, startLine),
      sequence: findNearest(3, startLine),
    });

    // Advance outer loop
    i = j - 1;
  }

  return { title, panels };
}
