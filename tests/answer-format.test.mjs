import assert from "node:assert/strict";
import test from "node:test";

import {
  parseAnswerBlocks,
  stripSourceCitations,
} from "../app/lib/answer-format.ts";
import { buildTableWorkbook } from "../app/lib/xlsx.ts";

test("removes inline and final source citations from the visible answer", () => {
  const answer = `The recorded attendance is shown below. [BHRC 30, p. 2]

SOURCE_CITATIONS: [BHRC 30, p. 2] [BHRC 31, p. 2]`;

  assert.equal(
    stripSourceCitations(answer),
    "The recorded attendance is shown below.",
  );
});

test("parses a Markdown attendance table into structured rows", () => {
  const answer = `Attendance by meeting:

| Meeting | Recorded attendees |
| --- | ---: |
| BHRC 30 | 12 |
| BHRC 31 | 14 |

SOURCE_CITATIONS: [BHRC 30, p. 2] [BHRC 31, p. 2]`;

  assert.deepEqual(parseAnswerBlocks(answer), [
    { type: "text", text: "Attendance by meeting:" },
    {
      type: "table",
      table: {
        headers: ["Meeting", "Recorded attendees"],
        rows: [
          ["BHRC 30", "12"],
          ["BHRC 31", "14"],
        ],
      },
    },
  ]);
});

test("builds a downloadable Excel workbook from a response table", () => {
  const workbook = buildTableWorkbook({
    headers: ["Meeting", "Recorded attendees"],
    rows: [
      ["BHRC 30", "12"],
      ["BHRC 31", "14"],
    ],
  });
  const contents = new TextDecoder().decode(workbook);

  assert.equal(workbook[0], 0x50);
  assert.equal(workbook[1], 0x4b);
  assert.match(contents, /xl\/worksheets\/sheet1\.xml/);
  assert.match(contents, /Recorded attendees/);
  assert.match(contents, /BHRC 31/);
});
