import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class StreamlitSourceTests(unittest.TestCase):
    def test_streamlit_entrypoint_is_grounded_and_passcode_protected(self):
        source = (ROOT / "streamlit_app.py").read_text(encoding="utf-8")
        self.assertIn("DOCUMENT LIBRARY - BEGIN", source)
        self.assertIn("The document library is the sole source of truth", source)
        self.assertIn("hmac.compare_digest", source)
        self.assertIn("https://api.openai.com/v1/responses", source)
        self.assertIn("gpt-5-mini", source)
        self.assertIn('page_title="BHRC Archives"', source)
        self.assertIn(
            'CONTACT_MESSAGE = "Please contact the relevant departments."',
            source,
        )
        self.assertNotIn("That passcode is not correct.", source)

    def test_five_documents_are_available_as_static_sources(self):
        metadata = json.loads(
            (ROOT / "app" / "data" / "document-meta.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual(len(metadata), 5)
        self.assertEqual(sum(item["pageCount"] for item in metadata), 27)
        for document in metadata:
            self.assertTrue(
                (ROOT / "static" / "documents" / document["file"]).exists()
            )


if __name__ == "__main__":
    unittest.main()
