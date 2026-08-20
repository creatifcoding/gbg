from __future__ import annotations

import json
from pathlib import Path
import tempfile
import unittest

from mantis_lab.artifacts import ArtifactError, build_manifest, verify_manifest


class ArtifactManifestTests(unittest.TestCase):
    def test_build_and_verify(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "sample.txt").write_text("mantis\n", encoding="utf-8")
            manifest = build_manifest(root, ["sample.txt"])
            self.assertEqual([], verify_manifest(root, manifest))

            (root / "sample.txt").write_text("changed\n", encoding="utf-8")
            self.assertTrue(verify_manifest(root, manifest))

    def test_rejects_escape(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ArtifactError):
                build_manifest(Path(directory), ["../outside.txt"])


if __name__ == "__main__":
    unittest.main()

