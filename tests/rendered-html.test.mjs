import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

test("defines the BHRC assistant shell and production metadata", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /title: "BHRC Minutes Assistant"/);
  assert.match(layout, /Ask questions across five BHRC meetings/);
  assert.match(layout, /\/og\.png/);
  assert.match(page, /Checking access/);
  assert.match(page, /Ask the minutes\./);
  assert.doesNotMatch(`${page}\n${layout}`, /codex-preview|Your site is taking shape/i);
});

test("ships five page-level source documents without client-side corpus text", async () => {
  const [documents, metadata, page, packageJson] = await Promise.all([
    readFile(new URL("../app/data/documents.json", import.meta.url), "utf8"),
    readFile(new URL("../app/data/document-meta.json", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  const parsedDocuments = JSON.parse(documents);
  const parsedMetadata = JSON.parse(metadata);

  assert.equal(parsedDocuments.length, 5);
  assert.equal(
    parsedDocuments.reduce((sum, document) => sum + document.pages.length, 0),
    27,
  );
  assert.equal(parsedMetadata.length, 5);
  assert.ok(parsedMetadata.every((document) => !("pages" in document)));
  assert.match(page, /document-meta\.json/);
  assert.doesNotMatch(page, /documents\.json/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(packageJson, /site-creator-vinext-starter/);

  await Promise.all(
    parsedMetadata.map((document) =>
      access(
        new URL(
          `./public${document.href}`,
          templateRoot,
        ),
      ),
    ),
  );
});
