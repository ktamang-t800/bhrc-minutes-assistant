#!/usr/bin/env python3
"""Extract the five BHRC PDFs into page-level JSON for grounded answers."""

from __future__ import annotations

import json
import re
import shutil
import sys
import unicodedata
from pathlib import Path

from pypdf import PdfReader


DOCUMENTS = [
    {
        "source": "20250319-Minutes-of-the-30th-BHRC-Meeting.pdf",
        "file": "bhrc-30-2025-03-19.pdf",
        "id": "bhrc-30",
        "meetingNumber": 30,
        "meetingLabel": "30th BHRC Meeting",
        "date": "March 19, 2025",
        "isoDate": "2025-03-19",
    },
    {
        "source": "Minutes-of-the-31st-BHRC-Meeting.pdf",
        "file": "bhrc-31-2025-05-29.pdf",
        "id": "bhrc-31",
        "meetingNumber": 31,
        "meetingLabel": "31st BHRC Meeting",
        "date": "May 29, 2025",
        "isoDate": "2025-05-29",
    },
    {
        "source": "Minutes-of-the-32nd-BHRC-Meeting.pdf",
        "file": "bhrc-32-2025-09-16.pdf",
        "id": "bhrc-32",
        "meetingNumber": 32,
        "meetingLabel": "32nd BHRC Meeting",
        "date": "September 16, 2025",
        "isoDate": "2025-09-16",
    },
    {
        "source": "20251203-Minutes-of-the-33rd-BHRC-Meeting.pdf",
        "file": "bhrc-33-2025-12-03.pdf",
        "id": "bhrc-33",
        "meetingNumber": 33,
        "meetingLabel": "33rd BHRC Meeting",
        "date": "December 3, 2025",
        "isoDate": "2025-12-03",
    },
    {
        "source": "20260324-Minutes-of-the-34th-BHRC-Meeting.pdf",
        "file": "bhrc-34-2026-03-24.pdf",
        "id": "bhrc-34",
        "meetingNumber": 34,
        "meetingLabel": "34th BHRC Meeting",
        "date": "March 24, 2026",
        "isoDate": "2026-03-24",
    },
]


def clean_text(value: str) -> str:
    value = unicodedata.normalize("NFKC", value)
    # A font-encoding issue in later PDFs renders the common "ti" ligature
    # as a replacement character (e.g. Interna�onal, Par�cipants).
    value = value.replace("\ufffd", "ti")
    value = value.replace("\u00a0", " ")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r" *\n *", "\n", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit(
            "Usage: extract_documents.py <source-pdf-directory> <project-root>"
        )

    source_dir = Path(sys.argv[1]).expanduser().resolve()
    project_root = Path(sys.argv[2]).expanduser().resolve()
    public_dir = project_root / "public" / "documents"
    data_dir = project_root / "app" / "data"
    public_dir.mkdir(parents=True, exist_ok=True)
    data_dir.mkdir(parents=True, exist_ok=True)

    extracted = []
    for metadata in DOCUMENTS:
        source = source_dir / metadata["source"]
        if not source.exists():
            raise FileNotFoundError(source)

        destination = public_dir / metadata["file"]
        shutil.copy2(source, destination)

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

        extracted.append(
            {
                **{key: value for key, value in metadata.items() if key != "source"},
                "pageCount": len(pages),
                "href": f"/documents/{metadata['file']}",
                "pages": pages,
            }
        )

    output = data_dir / "documents.json"
    output.write_text(
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
        f"{sum(item['pageCount'] for item in extracted)} pages to {output}"
    )


if __name__ == "__main__":
    main()
