"""Publication guards: exercise disclosure prevention against a temporary tree."""

import importlib.util
import json
from pathlib import Path
import tarfile
import tempfile
import unittest


SPEC = importlib.util.spec_from_file_location("export_opensource", Path(__file__).resolve().parents[1] / "scripts/export-opensource.py")
EXPORTER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(EXPORTER)


class ExportGuardTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)
        self.source = self.base / "private-source"
        self.source.mkdir()
        self.policy = {
            "root_files": ["README.md"], "extra_files": [],
            "source_trees": {"api": [".go"], "static": [".html", ".js"]},
            "excluded_prefixes": ["static/fonts/", "static/vendor/"],
            "excluded_files": [], "required_files": ["README.md", "api/main.go"],
        }
        self.write("README.md", "Public documentation\n")
        self.write("api/main.go", "package main\nfunc main() {}\n")

    def write(self, relative, content):
        path = self.source / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content if isinstance(content, bytes) else content.encode())
        return path

    def test_allowlist_excludes_history_private_data_and_nested_credentials(self):
        for relative in (".git/config", "docs/customer-backup.json", "api/.env", "api/credentials/private.go", "static/fonts/private.js", "static/vendor/unknown.js"):
            self.write(relative, "private material")
        included, excluded, findings = EXPORTER.source_inventory(self.source, self.policy)
        self.assertEqual(included, ["README.md", "api/main.go"])
        self.assertEqual(len(excluded), 6)
        self.assertEqual(findings, [])

    def test_detected_secret_stops_export_without_printing_value(self):
        synthetic_key = b"AIza" + b"A" * 35
        self.write("api/secret.go", b'const key = "' + synthetic_key + b'"')
        destination = self.base / "public-source"
        result = EXPORTER.create_export(self.source, destination, self.policy)
        self.assertFalse(result["ok"])
        self.assertFalse(destination.exists())
        self.assertNotIn(synthetic_key.decode(), json.dumps(result))

    def test_executables_cannot_hide_behind_source_extensions(self):
        self.write("api/untrusted.go", b"\x7fELF" + b"\0" * 100)
        _, _, findings = EXPORTER.source_inventory(self.source, self.policy)
        self.assertEqual(findings[0]["rule"], "native-executable")

    def test_symlinks_are_never_copied(self):
        sensitive = self.base / "sensitive.go"
        sensitive.write_text("do not publish")
        (self.source / "api/linked.go").symlink_to(sensitive)
        included, excluded, findings = EXPORTER.source_inventory(self.source, self.policy)
        self.assertNotIn("api/linked.go", included)
        self.assertIn("symlink-not-exported", [item["reason"] for item in excluded])
        self.assertEqual(findings, [])

    def test_export_and_archive_contain_current_source_and_hashes(self):
        destination = self.base / "public-source"
        result = EXPORTER.create_export(self.source, destination, self.policy)
        self.assertTrue(result["ok"])
        self.assertTrue(EXPORTER.check_export(destination, self.policy)["ok"])
        self.assertFalse((destination / ".git").exists())
        with tarfile.open(result["archive"]) as archive:
            self.assertIn("public-source/api/main.go", archive.getnames())
            self.assertTrue(all(member.uid == 0 and member.mtime == 0 for member in archive.getmembers()))
        (destination / "api/main.go").write_text("changed after export\n")
        validation = EXPORTER.check_export(destination, self.policy)
        self.assertFalse(validation["ok"])
        self.assertIn("manifest-hash-mismatch", [issue["rule"] for issue in validation["findings"]])

    def test_check_fails_for_added_git_history_and_forbidden_files(self):
        destination = self.base / "public-source"
        EXPORTER.create_export(self.source, destination, self.policy)
        (destination / ".git").mkdir()
        (destination / ".git/config").write_text("private remote")
        self.assertFalse(EXPORTER.check_export(destination, self.policy)["ok"])

    def test_existing_output_is_preserved(self):
        destination = self.base / "existing"
        destination.mkdir()
        marker = destination / "keep.txt"
        marker.write_text("keep")
        with self.assertRaises(FileExistsError):
            EXPORTER.create_export(self.source, destination, self.policy)
        self.assertEqual(marker.read_text(), "keep")

    def test_required_missing_source_stops_export(self):
        (self.source / "api/main.go").unlink()
        result = EXPORTER.create_export(self.source, self.base / "public-source", self.policy)
        self.assertFalse(result["ok"])
        self.assertEqual(result["findings"][0]["rule"], "required-source-missing")

    def test_known_documentation_access_id_does_not_block(self):
        documented_example = b"AKIA" + b"IOSFODNN7EXAMPLE"
        self.assertEqual(EXPORTER.secret_findings("example.go", documented_example), [])

    def test_local_module_dependencies_must_be_in_allowlist(self):
        self.policy["source_trees"]["api"].append(".mod")
        self.write("api/go.mod", "module local/api\nreplace helper => ../modules/helper\n")
        self.write("modules/helper/go.mod", "module helper\n")
        _, _, findings = EXPORTER.source_inventory(self.source, self.policy)
        self.assertIn("local-go-module-missing-from-export", [issue["rule"] for issue in findings])

    def test_generated_portable_guides_are_identical(self):
        destination = self.base / "public-source"
        EXPORTER.create_export(self.source, destination, self.policy)
        self.assertEqual((destination / "AGENTS.md").read_bytes(), (destination / "CLAUDE.md").read_bytes())
        (destination / "AGENTS.md").write_text("internal instructions")
        findings = EXPORTER.check_export(destination, self.policy)["findings"]
        self.assertIn("portable-guide-mismatch", [issue["rule"] for issue in findings])

    def test_actual_public_policy_excludes_removed_extension_tool_sources(self):
        policy = EXPORTER.load_policy(EXPORTER.ROOT)
        for relative in (
            "apps/private-tool/cmd/main.go", "cloud/src/index.ts", "daemon/src/main.rs",
            "static/launcher.html", "static/xiaohongshu.html", "static/kekelink.html",
            "static/logos/insight-logo.svg", "static/logos/kekelink-logo.svg",
            "static/logos/seller-booster-logo.svg", "static/logos/shorts-captain-logo.svg",
        ):
            self.assertIsNotNone(EXPORTER.inclusion_reason(relative, policy))
        self.assertIsNone(EXPORTER.inclusion_reason("static/logos/makeke-logo.svg", policy))
        self.assertIsNone(EXPORTER.inclusion_reason("chrome-extension/background.js", policy))
        self.assertFalse(any(tree.startswith("apps/") for tree in policy["source_trees"]))
        self.assertFalse(any(relative.startswith("apps/") for relative in policy["required_files"]))


if __name__ == "__main__":
    unittest.main()
