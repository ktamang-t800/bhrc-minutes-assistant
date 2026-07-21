#!/usr/bin/env python3
"""Build the BHRC page-level archive from verified PDF sources."""

from __future__ import annotations

import json
import re
import shutil
import sys
import unicodedata
from datetime import date
from pathlib import Path

from pypdf import PdfReader


EXISTING_DOCUMENTS = [
    {
        "file": "bhrc-30-2025-03-19.pdf",
        "id": "bhrc-30",
        "meetingNumber": 30,
        "meetingLabel": "30th BHRC Meeting",
        "date": "March 19, 2025",
        "isoDate": "2025-03-19",
    },
    {
        "file": "bhrc-31-2025-05-29.pdf",
        "id": "bhrc-31",
        "meetingNumber": 31,
        "meetingLabel": "31st BHRC Meeting",
        "date": "May 29, 2025",
        "isoDate": "2025-05-29",
    },
    {
        "file": "bhrc-32-2025-09-16.pdf",
        "id": "bhrc-32",
        "meetingNumber": 32,
        "meetingLabel": "32nd BHRC Meeting",
        "date": "September 16, 2025",
        "isoDate": "2025-09-16",
    },
    {
        "file": "bhrc-33-2025-12-03.pdf",
        "id": "bhrc-33",
        "meetingNumber": 33,
        "meetingLabel": "33rd BHRC Meeting",
        "date": "December 3, 2025",
        "isoDate": "2025-12-03",
    },
    {
        "file": "bhrc-34-2026-03-24.pdf",
        "id": "bhrc-34",
        "meetingNumber": 34,
        "meetingLabel": "34th BHRC Meeting",
        "date": "March 24, 2026",
        "isoDate": "2026-03-24",
    },
]


def ordinal(value: int) -> str:
    if 10 <= value % 100 <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(value % 10, "th")
    return f"{value}{suffix}"


def display_date(value: str) -> str:
    parsed = date.fromisoformat(value)
    return f"{parsed.strftime('%B')} {parsed.day}, {parsed.year}"


def clean_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value)
    # A font-encoding issue in later PDFs renders the common "ti" ligature
    # as a replacement character (for example, Interna�onal).
    value = value.replace("\ufffd", "ti")
    value = value.replace("\u00a0", " ")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r" *\n *", "\n", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def source_path(project_root: Path, filename: str) -> Path:
    candidates = [
        project_root / "static" / "documents" / filename,
        project_root / "public" / "documents" / filename,
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    raise FileNotFoundError(filename)


def document_definitions(project_root: Path) -> list[dict[str, object]]:
    definitions: list[dict[str, object]] = []
    for item in EXISTING_DOCUMENTS:
        definitions.append(
            {**item, "source": source_path(project_root, str(item["file"]))}
        )

    inventory_path = project_root / "incoming" / "inventory.json"
    inventory = json.loads(inventory_path.read_text(encoding="utf-8"))
    for item in inventory["receivedDocuments"]:
        meeting_number = int(item["meetingNumber"])
        iso_date = str(item["meetingDate"])
        filename = f"bhrc-{meeting_number}-{iso_date}.pdf"
        definitions.append(
            {
                "source": project_root
                / "incoming"
                / str(item["originalFilename"]),
                "file": filename,
                "id": f"bhrc-{meeting_number}",
                "meetingNumber": meeting_number,
                "meetingLabel": f"{ordinal(meeting_number)} BHRC Meeting",
                "date": display_date(iso_date),
                "isoDate": iso_date,
            }
        )

    definitions.sort(key=lambda item: int(item["meetingNumber"]))
    meeting_numbers = [int(item["meetingNumber"]) for item in definitions]
    expected = list(range(1, max(meeting_numbers) + 1))
    if meeting_numbers != expected:
        raise ValueError(
            f"The archive must be continuous. Found {meeting_numbers}; expected {expected}."
        )
    return definitions


def copy_pdf(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if source.resolve() != destination.resolve():
        shutil.copy2(source, destination)


def main() -> None:
    if len(sys.argv) not in {2, 3}:
        raise SystemExit(
            "Usage: extract_documents.py <project-root> OR "
            "extract_documents.py <legacy-source-directory> <project-root>"
        )

    project_root = Path(sys.argv[-1]).expanduser().resolve()
    public_dir = project_root / "public" / "documents"
    static_dir = project_root / "static" / "documents"
    data_dir = project_root / "app" / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    extracted = []
    for metadata in document_definitions(project_root):
        source = Path(metadata["source"])
        if not source.exists():
            raise FileNotFoundError(source)

        filename = str(metadata["file"])
        copy_pdf(source, public_dir / filename)
        copy_pdf(source, static_dir / filename)

        reader = PdfReader(source)
        pages = [
            {
                "page": page_number,
                "text": clean_text(page.extract_text() or ""),
            }
            for page_number, page in enumerate(reader.pages, start=1)
        ]
        if any(not page["text"] for page in pages):
            raise ValueError(f"One or more empty pages found in {source.name}")

        public_metadata = {
            key: value
            for key, value in metadata.items()
            if key != "source"
        }
        extracted.append(
            {
                **public_metadata,
                "pageCount": len(pages),
                "href": f"/documents/{filename}",
                "pages": pages,
            }
        )

    documents_output = data_dir / "documents.json"
    documents_output.write_text(
        json.dumps(extracted, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    metadata_output = data_dir / "document-meta.json"
    metadata_output.write_text(
        json.dumps(
            [
                {key: value for key, value in item.items() if key != "pages"}
                for item in extracted
            ],
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(
        f"Extracted {len(extracted)} documents and "
        f"{sum(item['pageCount'] for item in extracted)} pages."
    )


if __name__ == "__main__":
    main()
