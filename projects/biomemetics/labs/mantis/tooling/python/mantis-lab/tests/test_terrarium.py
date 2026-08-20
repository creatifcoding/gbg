from __future__ import annotations

from pathlib import Path
import json
import shutil
import tempfile
import unittest

from mantis_lab.terrarium import validate_draft_b


class TerrariumLocksTests(unittest.TestCase):
    def setUp(self) -> None:
        self.workspace = Path(__file__).resolve().parents[4]

    def test_repository_draft_b_locks(self) -> None:
        self.assertEqual([], validate_draft_b(self.workspace))

    def draft_copy(self, root: Path) -> Path:
        target = root / "terrarium"
        (target / "ee").mkdir(parents=True)
        shutil.copy2(self.workspace / "terrarium" / "params.json", target)
        shutil.copy2(self.workspace / "terrarium" / "bus.json", target)
        shutil.copytree(
            self.workspace / "terrarium" / "ee" / "protocols",
            target / "ee" / "protocols",
        )
        return target

    def test_rejects_epistemic_status_downgrade(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            terrarium = self.draft_copy(root)
            path = terrarium / "params.json"
            document = json.loads(path.read_text(encoding="utf-8"))
            document["parameters"]["frame.module_pitch"]["status"] = "target"
            path.write_text(json.dumps(document), encoding="utf-8")
            self.assertTrue(
                any("frame.module_pitch status" in failure for failure in validate_draft_b(root))
            )

    def test_rejects_unreviewed_safety_evidence_and_transition_drift(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            terrarium = self.draft_copy(root)
            path = terrarium / "bus.json"
            document = json.loads(path.read_text(encoding="utf-8"))
            document["safetyRequirements"][0]["evidenceRefs"] = ["invented-pass"]
            document["transitions"][7]["actions"] = ["permit-roller-translation-early"]
            path.write_text(json.dumps(document), encoding="utf-8")
            failures = validate_draft_b(root)
            self.assertTrue(any("cannot claim evidence" in failure for failure in failures))
            self.assertTrue(any("permit-roller-translation" in failure for failure in failures))


if __name__ == "__main__":
    unittest.main()
