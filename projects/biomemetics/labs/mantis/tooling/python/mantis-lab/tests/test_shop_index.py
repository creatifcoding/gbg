from __future__ import annotations

import json
from pathlib import Path
import unittest

from mantis_lab.artifacts import verify_manifest


WORKSPACE = Path(__file__).resolve().parents[4]
SHOP = WORKSPACE / "terrarium" / "shop"
INDEXER = SHOP / "build_index.py"
MANIFEST = SHOP / "manifest.json"
BASELINE = WORKSPACE / "terrarium" / "MANIFEST.sha256"


class DraftShopIndexTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.document = json.loads(MANIFEST.read_text(encoding="utf-8"))
        cls.indexer_source = INDEXER.read_text(encoding="utf-8")

    def test_stays_draft_and_unclaimed(self) -> None:
        self.assertEqual("DRAFT", self.document["packageClass"])
        self.assertEqual("generated", self.document["lifecycle"])
        self.assertTrue(self.document["notABaseline"])
        claims = self.document["claims"]
        self.assertFalse(claims["SHOP-RELEASE"])
        self.assertFalse(claims["QUALIFIED"])
        self.assertFalse(claims["order"])
        self.assertFalse(claims["energize"])
        self.assertFalse(claims["cad02AdmitsPr34AsReleasedParent"])

    def test_honesty_classes_and_hitl_look(self) -> None:
        allowed = {"draft-measured", "theoretical", "diagram"}
        hitl = 0
        for record in self.document["artifacts"]:
            self.assertIn(record["honestyClass"], allowed)
            if record["path"].startswith("terrarium/schematics/hitl/"):
                hitl += 1
                self.assertEqual("look", record["role"])
                self.assertEqual("diagram", record["honestyClass"])
                self.assertTrue(record["notGeometry"])
        self.assertEqual(12, hitl)

    def test_committed_hashes_match_tree(self) -> None:
        failures = verify_manifest(WORKSPACE, self.document)
        self.assertEqual([], list(failures))

    def test_does_not_rewrite_immutable_baseline(self) -> None:
        self.assertTrue(BASELINE.is_file())
        self.assertNotIn("BASELINE.write", self.indexer_source)
        self.assertIn("ADR-003", self.document["immutableBaseline"]["policy"])
        self.assertGreater(
            self.document["immutableBaseline"]["stackedSheetMismatchCount"], 0
        )

    def test_indexer_does_not_export_step(self) -> None:
        self.assertNotIn("export_carriage_step", self.indexer_source)
        self.assertNotIn("subprocess", self.indexer_source)
        self.assertIn("shutil.which(\"FreeCADCmd\")", self.indexer_source)

    def test_unverified_items_are_named_not_invented(self) -> None:
        missing_ids = {item["id"] for item in self.document["missing"]}
        self.assertIn("camera-sku", missing_ids)
        self.assertIn("connector-pinout", missing_ids)
        self.assertIn("s1-s2-q1-mpn", missing_ids)
        joined = json.dumps(self.document)
        self.assertNotIn('"pinout": {', joined)
        self.assertIn("UNVERIFIED", joined)


if __name__ == "__main__":
    unittest.main()
