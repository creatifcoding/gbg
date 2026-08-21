from __future__ import annotations

import json
from pathlib import Path
import tempfile
import unittest

from mantis_lab.workspace import WorkspaceError, discover_workspace, load_workspace


class WorkspaceContractTests(unittest.TestCase):
    def test_repository_workspace_contract(self) -> None:
        workspace = Path(__file__).resolve().parents[4]
        value = load_workspace(workspace)
        self.assertEqual("biomemetics.mantis", value["workspaceId"])
        self.assertEqual("terrarium", next(iter(value["projects"])))
        self.assertEqual(workspace, discover_workspace(workspace / "terrarium"))

    def test_rejects_legacy_or_escaping_contract(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            value = {
                "kind": "BiomemeticsLabWorkspace",
                "workspaceId": "biomemetics.mantis",
                "repositoryPath": "projects/biomemetics/labs/mantis",
                "lanes": {"observations": {"path": "../escape"}},
                "members": {"contracts": {"path": "contracts"}},
                "projects": {"terrarium": {"path": "terrarium"}},
            }
            (root / "workspace.json").write_text(
                json.dumps(value), encoding="utf-8"
            )
            with self.assertRaises(WorkspaceError):
                load_workspace(root)


if __name__ == "__main__":
    unittest.main()
