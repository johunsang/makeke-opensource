#!/usr/bin/env python3
"""Export reviewed live source, without private history, data, or bundled tools.

No network requests, Git mutations, remote publication, or secret values in output.
The allowlist is intentionally conservative. A successful scan is not a guarantee
that every possible secret or third-party rights issue has been discovered.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tarfile
import tempfile


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = "opensource/manifest.json"
PRUNED_DIRS = {
    ".git", ".hg", ".svn", "node_modules", "__pycache__", ".venv", "venv",
    ".wrangler", "target", "dist", "build_dist", "artifacts", ".next",
    "credentials", "_secrets", "certs", ".keys", ".bbarit",
}
PRIVATE_SUFFIXES = {".db", ".sqlite", ".sqlite3", ".pem", ".key", ".p12", ".pfx", ".pickle"}
NATIVE_MAGIC = (b"\x7fELF", b"MZ", b"\xcf\xfa\xed\xfe", b"\xfe\xed\xfa\xcf", b"\xca\xfe\xba\xbe")
ASSET_SUFFIXES = {".png", ".ico", ".icns"}
SECRET_PATTERNS = {
    "private-key": rb"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----",
    "google-api-key": rb"AIza[0-9A-Za-z_-]{35}",
    "github-token": rb"(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,})",
    "aws-access-id": rb"(?:AKIA|ASIA)[A-Z0-9]{16}",
    "google-access-token": rb"ya29\.[A-Za-z0-9_.-]{20,}",
    "slack-token": rb"xox[baprs]-[A-Za-z0-9-]{20,}",
    "openai-api-key": rb"sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}",
    "stripe-live-key": rb"[rs]k_live_[A-Za-z0-9]{20,}",
}
DOCUMENTED_EXAMPLES = {b"AKIAIOSFODNN7EXAMPLE", b"ASIAIOSFODNN7EXAMPLE"}
CREDENTIAL_LITERAL = re.compile(
    rb"(?im)(?:password|passwd|client[_-]?secret|api[_-]?key|access[_-]?token|refresh[_-]?token)"
    rb"[\"' ]*\s*[:=]\s*[\"']([^\"'\r\n]{20,})[\"']"
)
GENERATED_FILES = {".gitignore", "AGENTS.md", "CLAUDE.md", "SOURCE_MANIFEST.json"}
PUBLIC_AGENT_GUIDE = """# Makeke contributor guide

This is the clean source distribution. Read README.md, CONTRIBUTING.md,
SECURITY.md, and THIRD_PARTY_NOTICES.md before changing the project.

- Main application: Electron in electron/, Go API in api/, UI in static/.
- Shared loopback HTTP validation lives in modules/localhttp.
- Project accounts, subscriptions, and central product access gates are removed.
- Keep API listeners bound to loopback. Preserve Host and Origin validation.
- External AI and social-network credentials are provided locally by each user.
- Never commit credentials, local databases, account exports, generated media,
  installer binaries, or files copied from the original private history.
- Keep third-party notices and review upstream terms before bundling components.
- Do not restore a production deployment, automatic updater, or release workflow.
- Preserve unrelated local work. Run checks for the code you change.

Useful checks:

    python3 -m unittest discover -s tests -p 'export_opensource_test.py' -v
    python3 scripts/export-opensource.py --audit
    node --check electron/main.js
    node --check electron/preload.js
    cd api && go test ./...

Use scripts/export-opensource.py to create a new reviewed source directory and
archive. It excludes private data, Git history, and unreviewed bundled assets.
Read docs/OPEN_SOURCE.md for the export boundary and optional components.
"""
PUBLIC_IGNORE = """# Local secrets and user data
_secrets/
credentials/
.env
.env.*
!.env.example
.dev.vars
*.key
*.pem
*.p12
*.pfx
*.db
*.db-*
*.sqlite*
config.ini
certs/
.keys/
# Dependencies, generated content, builds and operating-system metadata
node_modules/
target/
.wrangler/
.next/
__pycache__/
.venv/
.DS_Store
artifacts/
output/
dist/
build_dist/
api/bin/
electron/bin/
vendor/
static/fonts/
*.log
*.zip
*.exe
*.dmg
*.app/
"""


def load_policy(root: Path) -> dict:
    policy = json.loads((root / MANIFEST).read_text(encoding="utf-8"))
    if policy.get("schema_version") != 1:
        raise ValueError("Unsupported source allowlist schema")
    return policy


def private_name(path: Path) -> bool:
    return (
        any(part in PRUNED_DIRS for part in path.parts)
        or path.name.startswith((".env", ".dev.vars"))
        or path.suffix.lower() in PRIVATE_SUFFIXES
        or path.name in {"config.ini", "firestore-backup.json"}
    )


def inclusion_reason(relative: str, policy: dict) -> str | None:
    path = Path(relative)
    if private_name(path):
        return "private-or-generated-path"
    if relative in policy["excluded_files"]:
        return "excluded-legacy-service"
    if any(relative.startswith(prefix) for prefix in policy["excluded_prefixes"]):
        return "excluded-data-or-unreviewed-third-party"
    if relative in policy["root_files"] or relative in policy["extra_files"]:
        return None
    for tree, suffixes in policy["source_trees"].items():
        if relative.startswith(tree + "/") and path.suffix.lower() in suffixes:
            return None
    return "outside-reviewed-source-allowlist"


def secret_findings(relative: str, content: bytes) -> list[dict]:
    findings = []
    for rule, expression in SECRET_PATTERNS.items():
        for match in re.finditer(expression, content):
            if match.group() not in DOCUMENTED_EXAMPLES:
                findings.append({"path": relative, "line": content[:match.start()].count(b"\n") + 1, "rule": rule})
    for match in CREDENTIAL_LITERAL.finditer(content):
        literal = match.group(1)
        # References, explanatory text, and explicit examples are not credentials.
        if not re.fullmatch(rb"[A-Za-z0-9_+/.=-]+", literal):
            continue
        if re.search(rb"(?i)(example|placeholder|replace|your[_-]|test[_-]|process|environ)", literal):
            continue
        if len(set(literal)) < 12:
            continue
        findings.append({"path": relative, "line": content[:match.start()].count(b"\n") + 1, "rule": "credential-literal-review"})
    return findings


def inspect_file(path: Path, relative: str) -> list[dict]:
    content = path.read_bytes()
    if content.startswith(NATIVE_MAGIC):
        return [{"path": relative, "rule": "native-executable"}]
    if path.suffix.lower() in ASSET_SUFFIXES:
        return []
    if b"\0" in content:
        return [{"path": relative, "rule": "unexpected-binary"}]
    return secret_findings(relative, content)


def local_module_findings(root: Path, inventory: list[str]) -> list[dict]:
    root = root.resolve()
    findings = []
    included = set(inventory)
    for relative in inventory:
        if not relative.endswith("go.mod"):
            continue
        module_file = root / relative
        for target in re.findall(r"=>\s+(\.\.?[/\\][^\s)]+)", module_file.read_text(encoding="utf-8")):
            dependency = (module_file.parent / target / "go.mod").resolve()
            if not dependency.is_relative_to(root):
                findings.append({"path": relative, "rule": "local-go-module-outside-source"})
            elif dependency.relative_to(root).as_posix() not in included:
                findings.append({"path": relative, "rule": "local-go-module-missing-from-export"})
    return findings


def source_inventory(root: Path, policy: dict) -> tuple[list[str], list[dict], list[dict]]:
    included, excluded, findings = [], [], []
    for directory, dirs, files in os.walk(root, followlinks=False):
        parent = Path(directory)
        for dirname in list(dirs):
            candidate = parent / dirname
            if dirname in PRUNED_DIRS or candidate.is_symlink():
                dirs.remove(dirname)
                excluded.append({"path": candidate.relative_to(root).as_posix() + "/", "reason": "private-generated-or-symlink-directory"})
        for filename in files:
            candidate = parent / filename
            relative = candidate.relative_to(root).as_posix()
            reason = inclusion_reason(relative, policy)
            if candidate.is_symlink():
                reason = "symlink-not-exported"
            if reason:
                excluded.append({"path": relative, "reason": reason})
                continue
            issues = inspect_file(candidate, relative)
            findings.extend(issues)
            included.append(relative)
    missing = sorted(set(policy["required_files"]) - set(included))
    findings.extend({"path": relative, "rule": "required-source-missing"} for relative in missing)
    findings.extend(local_module_findings(root, included))
    return sorted(included), sorted(excluded, key=lambda item: item["path"]), findings


def check_export(root: Path, policy: dict) -> dict:
    findings, inventory = [], []
    for path in sorted(root.rglob("*")):
        relative = path.relative_to(root).as_posix()
        if path.is_symlink():
            findings.append({"path": relative, "rule": "symlink-in-export"})
            continue
        if path.is_dir():
            if any(part in PRUNED_DIRS for part in path.relative_to(root).parts):
                findings.append({"path": relative, "rule": "private-directory-in-export"})
            continue
        if relative not in GENERATED_FILES:
            reason = inclusion_reason(relative, policy)
            if reason:
                findings.append({"path": relative, "rule": reason})
        if relative in {"AGENTS.md", "CLAUDE.md"} and path.read_text(encoding="utf-8") != PUBLIC_AGENT_GUIDE:
            findings.append({"path": relative, "rule": "portable-guide-mismatch"})
        findings.extend(inspect_file(path, relative))
        inventory.append(relative)
    missing = sorted(set(policy["required_files"]) - set(inventory))
    findings.extend({"path": relative, "rule": "required-source-missing"} for relative in missing)
    findings.extend({"path": relative, "rule": "generated-manifest-or-guide-missing"} for relative in sorted(GENERATED_FILES - set(inventory)))
    findings.extend(local_module_findings(root, inventory))
    manifest_path = root / "SOURCE_MANIFEST.json"
    if manifest_path.is_file():
        declared = json.loads(manifest_path.read_text(encoding="utf-8"))["files"]
        actual = set(inventory) - {"SOURCE_MANIFEST.json"}
        if actual != set(declared):
            findings.append({"path": "SOURCE_MANIFEST.json", "rule": "manifest-file-set-mismatch"})
        for relative, expected in declared.items():
            candidate = root / relative
            if candidate.is_file() and hashlib.sha256(candidate.read_bytes()).hexdigest() != expected["sha256"]:
                findings.append({"path": relative, "rule": "manifest-hash-mismatch"})
    return {"ok": not findings, "file_count": len(inventory), "findings": findings}


def write_source_manifest(destination: Path, files: list[str]) -> None:
    entries = {}
    for relative in sorted(files + list(GENERATED_FILES - {"SOURCE_MANIFEST.json"})):
        content = (destination / relative).read_bytes()
        entries[relative] = {"bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()}
    payload = {"schema_version": 1, "history_included": False, "files": entries}
    (destination / "SOURCE_MANIFEST.json").write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def write_archive(destination: Path, archive: Path) -> None:
    with archive.open("xb") as raw:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as compressed:
            with tarfile.open(fileobj=compressed, mode="w") as tar:
                for path in sorted(destination.rglob("*")):
                    if not path.is_file():
                        continue
                    info = tar.gettarinfo(str(path), arcname=destination.name + "/" + path.relative_to(destination).as_posix())
                    info.uid = info.gid = info.mtime = 0
                    info.uname = info.gname = ""
                    with path.open("rb") as stream:
                        tar.addfile(info, stream)


def create_export(root: Path, output: Path, policy: dict) -> dict:
    archive, report = Path(str(output) + ".tar.gz"), Path(str(output) + ".excluded.json")
    if output == root or root.is_relative_to(output):
        raise ValueError("Export destination must not contain the source repository")
    if any(path.exists() or path.is_symlink() for path in (output, archive, report)):
        raise FileExistsError("Export destination, archive, or exclusion report already exists; choose a new path")
    files, excluded, findings = source_inventory(root, policy)
    if findings:
        return {"ok": False, "findings": findings, "included_count": len(files)}
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix=".opensource-export-", dir=output.parent))
    try:
        for relative in files:
            source, target = root / relative, temporary / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, target, follow_symlinks=False)
            target.chmod(0o755 if os.access(source, os.X_OK) else 0o644)
        (temporary / ".gitignore").write_text(PUBLIC_IGNORE, encoding="utf-8")
        for guide in ("AGENTS.md", "CLAUDE.md"):
            (temporary / guide).write_text(PUBLIC_AGENT_GUIDE, encoding="utf-8")
        write_source_manifest(temporary, files)
        validation = check_export(temporary, policy)
        if not validation["ok"]:
            return validation
        temporary.rename(output)
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)
    write_archive(output, archive)
    report.write_text(json.dumps({"excluded": excluded}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return {
        "ok": True, "output": str(output), "archive": str(archive), "exclusion_report": str(report),
        "file_count": validation["file_count"], "excluded_count": len(excluded),
        "archive_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="New export directory; existing destinations are never overwritten")
    parser.add_argument("--check", type=Path, help="Check an exported directory without changing it")
    parser.add_argument("--audit", action="store_true", help="Audit the live allowlisted source without copying")
    args = parser.parse_args()
    if sum(bool(value) for value in (args.output, args.check, args.audit)) != 1:
        parser.error("choose exactly one of --output, --check, or --audit")
    policy = load_policy(ROOT)
    try:
        if args.check:
            result = check_export(args.check.resolve(strict=True), policy)
        elif args.audit:
            included, excluded, findings = source_inventory(ROOT, policy)
            result = {"ok": not findings, "included_count": len(included), "excluded_count": len(excluded), "findings": findings}
        else:
            result = create_export(ROOT, args.output.resolve(), policy)
    except (OSError, ValueError, KeyError) as error:
        result = {"ok": False, "error": str(error)}
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
