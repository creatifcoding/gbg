from __future__ import annotations

import json
from pathlib import Path
import tempfile
import unittest

from mantis_lab.artifacts import (
    ArtifactError,
    build_manifest,
    review_manifest,
    verify_certifiable_manifest,
    verify_manifest,
    write_manifest,
)


class ArtifactManifestTests(unittest.TestCase):
    def test_build_and_verify(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "sample.txt").write_text("mantis\n", encoding="utf-8")
            manifest = build_manifest(root, ["sample.txt"])
            self.assertEqual(manifest["lifecycle"], "generated")
            self.assertEqual([], verify_manifest(root, manifest))
            self.assertTrue(verify_certifiable_manifest(root, manifest))

            (root / "sample.txt").write_text("changed\n", encoding="utf-8")
            self.assertTrue(verify_manifest(root, manifest))

    def test_review_promotes_without_rewriting_digests(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "sample.txt").write_text("mantis\n", encoding="utf-8")
            generated = build_manifest(root, ["sample.txt"])
            digest = generated["artifacts"][0]["sha256"]
            reviewed = review_manifest(
                generated, reviewer="tester", notes="ok", reviewed_at="2026-08-20T12:00:00Z"
            )
            self.assertEqual(reviewed["lifecycle"], "reviewed")
            self.assertEqual(reviewed["artifacts"][0]["sha256"], digest)
            self.assertEqual([], verify_certifiable_manifest(root, reviewed))

    def test_refuses_to_mint_baseline_filename(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "sample.txt").write_text("mantis\n", encoding="utf-8")
            manifest = build_manifest(root, ["sample.txt"])
            with self.assertRaises(ArtifactError):
                write_manifest(root / "MANIFEST.sha256", manifest)

    def test_rejects_escape(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ArtifactError):
                build_manifest(Path(directory), ["../outside.txt"])


if __name__ == "__main__":
    unittest.main()
