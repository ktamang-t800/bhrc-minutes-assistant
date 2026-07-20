export type AnswerTable = {
  headers: string[];
  rows: string[][];
};

export type AnswerBlock =
  | { type: "text"; text: string }
  | { type: "table"; table: AnswerTable };

const citationPattern =
  /\s*\[BHRC\s+\d+,\s*(?:p\.?|pages?)\s*\d+(?:\s*[–—-]\s*\d+)?\]/gi;

export function stripSourceCitations(text: string) {
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s*SOURCE_CITATIONS\s*:/i.test(line))
    .map((line) => line.replace(citationPattern, "").trimEnd())
    .join("\n")
    .trim();
}

function splitTableRow(line: string) {
  let value = line.trim();
  if (value.startsWith("|")) value = value.slice(1);
  if (value.endsWith("|") && !value.endsWith("\\|")) value = value.slice(0, -1);

  const cells: string[] = [];
  let cell = "";
  let escaped = false;

  for (const character of value) {
    if (escaped) {
      cell += character;
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === "|") {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }

  cells.push(cell.trim());
  return cells;
}

function isDividerRow(line: string) {
  if (!line.includes("|")) return false;
  const cells = splitTableRow(line);
  return (
    cells.length >= 2 &&
    cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")))
  );
}

function isTableStart(lines: string[], index: number) {
  return (
    Boolean(lines[index]?.includes("|")) &&
    Boolean(lines[index + 1]) &&
    isDividerRow(lines[index + 1])
  );
}

function normalizeRow(cells: string[], width: number) {
  return Array.from({ length: width }, (_, index) => cells[index] ?? "");
}

export function parseAnswerBlocks(text: string): AnswerBlock[] {
  const lines = stripSourceCitations(text).split("\n");
  const blocks: AnswerBlock[] = [];
  const textBuffer: string[] = [];

  const flushText = () => {
    const value = textBuffer.join("\n").trim();
    if (value) blocks.push({ type: "text", text: value });
    textBuffer.length = 0;
  };

  for (let index = 0; index < lines.length; index += 1) {
    if (!isTableStart(lines, index)) {
      textBuffer.push(lines[index]);
      continue;
    }

    flushText();
    const headers = splitTableRow(lines[index]);
    const rows: string[][] = [];
    index += 2;

    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim() || !line.includes("|") || isDividerRow(line)) break;
      rows.push(normalizeRow(splitTableRow(line), headers.length));
      index += 1;
    }

    blocks.push({
      type: "table",
      table: { headers, rows },
    });
    index -= 1;
  }

  flushText();
  return blocks;
}
