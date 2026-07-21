export type AnswerTable = {
  headers: string[];
  rows: string[][];
};

export type AnswerChart = {
  type: "bar" | "line" | "pie";
  title: string;
  tableIndex: number;
  labelColumn: string;
  valueColumns: string[];
};

export type AnswerBlock =
  | { type: "text"; text: string }
  | { type: "table"; table: AnswerTable }
  | { type: "chart"; chart: AnswerChart; table: AnswerTable };

const citationPattern =
  /\s*\[BHRC\s+\d+,\s*(?:p\.?|pages?)\s*\d+(?:\s*[–—-]\s*\d+)?\]/gi;

export function stripSourceCitations(text: string) {
  return text
    .split(/\r?\n/)
    .filter(
      (line) =>
        !/^\s*SOURCE_CITATIONS\s*:/i.test(line) &&
        !/^\s*CHART_SPEC\s*:/i.test(line),
    )
    .map((line) => line.replace(citationPattern, "").trimEnd())
    .join("\n")
    .trim();
}

function parseChartSpecs(text: string): AnswerChart[] {
  const specs: AnswerChart[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*CHART_SPEC\s*:\s*(\{.*\})\s*$/i);
    if (!match) continue;
    try {
      const value = JSON.parse(match[1]) as Partial<AnswerChart>;
      if (
        !["bar", "line", "pie"].includes(value.type ?? "") ||
        typeof value.title !== "string" ||
        !Number.isInteger(value.tableIndex) ||
        Number(value.tableIndex) < 1 ||
        typeof value.labelColumn !== "string" ||
        !Array.isArray(value.valueColumns) ||
        !value.valueColumns.length ||
        !value.valueColumns.every((column) => typeof column === "string")
      ) {
        continue;
      }
      specs.push(value as AnswerChart);
    } catch {
      // Ignore malformed or incomplete streamed chart metadata.
    }
  }
  return specs;
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
  const chartSpecs = parseChartSpecs(text);
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

  if (!chartSpecs.length) return blocks;

  const tables = blocks.filter(
    (block): block is Extract<AnswerBlock, { type: "table" }> =>
      block.type === "table",
  );
  const chartsByTable = new Map<number, AnswerChart[]>();

  for (const chart of chartSpecs) {
    const table = tables[chart.tableIndex - 1]?.table;
    if (
      !table ||
      !table.headers.includes(chart.labelColumn) ||
      !chart.valueColumns.every((column) => table.headers.includes(column)) ||
      (chart.type === "pie" && chart.valueColumns.length !== 1)
    ) {
      continue;
    }
    const current = chartsByTable.get(chart.tableIndex) ?? [];
    current.push(chart);
    chartsByTable.set(chart.tableIndex, current);
  }

  const output: AnswerBlock[] = [];
  let tableIndex = 0;
  for (const block of blocks) {
    output.push(block);
    if (block.type !== "table") continue;
    tableIndex += 1;
    for (const chart of chartsByTable.get(tableIndex) ?? []) {
      output.push({ type: "chart", chart, table: block.table });
    }
  }
  return output;
}
