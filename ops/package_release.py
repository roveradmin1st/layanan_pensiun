#!/usr/bin/env python3
"""
Packaging runtime release Layanan Pensiunan.
Creates reproducible, clean tar.gz runtime archives containing only allowlisted
production assets (backend/src, production node_modules, package manifests,
frontend/dist, .node-version, ecosystem config, release-manifest.json).

Strictly excludes:
- .git metadata
- SQLite databases (*.sqlite*, backend/data)
- Environment files (.env*, *.env)
- Credentials and private keys (*.private.json, *.pem, *.key)
- Test suites (tests/, *.test.*, *.spec.*)
- Privileged operator tools (ops/, /usr/local/bin)
- Temporary files and development caches
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tarfile
import tempfile

DATA_CONTRACT = "lp-production-20261109-v1"
MANIFEST_VERSION = 1

DENYLIST_PATTERNS = [
    re.compile(r"(^|/)\.git(/|$)"),
    re.compile(r"(^|/)\.env.*"),
    re.compile(r".*\.sqlite(-wal|-shm)?$"),
    re.compile(r".*\.sqlite3?$"),
    re.compile(r".*\.db(-wal|-shm)?$"),
    re.compile(r"(^|/)backend/data(/|$)"),
    re.compile(r".*\.private\.json$"),
    re.compile(r".*\.(pem|key|crt|pfx)$"),
    re.compile(r"(^|/)tests(/|$)"),
    re.compile(r".*\.test\.(mjs|js|ts)$"),
    re.compile(r".*\.spec\.(mjs|js|ts)$"),
    re.compile(r"(^|/)ops(/|$)"),
    re.compile(r"(^|/)Blue_Print(/|$)"),
    re.compile(r"(^|/)docs(/|$)"),
    re.compile(r".*\.log$"),
    re.compile(r"(^|/)\.vite(/|$)"),
    re.compile(r"(^|/)\.cache(/|$)"),
    re.compile(r"(^|/)node_modules/\.bin(/|$)"),
]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def is_denied(rel_path: str) -> bool:
    norm = rel_path.replace("\\", "/")
    return any(p.search(norm) for p in DENYLIST_PATTERNS)


def build_manifest(
    commit: str,
    files_map: dict[str, Path],
    node_version: str,
    created_at: str | None = None,
) -> dict:
    if not re.fullmatch(r"[0-9a-f]{40}", commit):
        raise ValueError(f"Commit must be a 40-character hex SHA, got: {commit}")

    created_iso = created_at or datetime.now(timezone.utc).isoformat()
    files_meta = {}
    for rel_path, abs_path in sorted(files_map.items()):
        if is_denied(rel_path):
            continue
        stat_info = abs_path.stat()
        files_meta[rel_path.replace("\\", "/")] = {
            "sha256": sha256_file(abs_path),
            "size": stat_info.st_size,
        }

    return {
        "manifest_version": MANIFEST_VERSION,
        "commit": commit,
        "created_at": created_iso,
        "target_os": "ubuntu-24.04",
        "target_arch": "x86_64",
        "node_version": node_version,
        "data_contract": DATA_CONTRACT,
        "files_count": len(files_meta),
        "files": files_meta,
    }


def collect_package_files(root: Path) -> dict[str, Path]:
    files: dict[str, Path] = {}

    # 1. .node-version
    node_ver_file = root / ".node-version"
    if not node_ver_file.is_file():
        raise FileNotFoundError(f"Missing required .node-version at {node_ver_file}")
    files[".node-version"] = node_ver_file

    # 2. backend/package.json & backend/package-lock.json
    for name in ("package.json", "package-lock.json"):
        p = root / "backend" / name
        if not p.is_file():
            raise FileNotFoundError(f"Missing required backend/{name} at {p}")
        files[f"backend/{name}"] = p

    # 3. backend/src/**
    src_dir = root / "backend" / "src"
    if not src_dir.is_dir():
        raise FileNotFoundError(f"Missing required backend/src directory at {src_dir}")
    for p in src_dir.rglob("*"):
        if p.is_file() and not p.is_symlink() and not is_denied(str(p.relative_to(root))):
            files[str(p.relative_to(root))] = p

    # 4. backend/node_modules/**
    nm_dir = root / "backend" / "node_modules"
    if nm_dir.is_dir():
        for p in nm_dir.rglob("*"):
            if p.is_file() and not p.is_symlink() and not is_denied(str(p.relative_to(root))):
                files[str(p.relative_to(root))] = p

    # 5. frontend/dist/**
    dist_dir = root / "frontend" / "dist"
    index_html = dist_dir / "index.html"
    if not index_html.is_file():
        raise FileNotFoundError(f"Missing required frontend build output at {index_html}")
    for p in dist_dir.rglob("*"):
        if p.is_file() and not p.is_symlink() and not is_denied(str(p.relative_to(root))):
            files[str(p.relative_to(root))] = p

    # 6. PM2 Ecosystem config (if exists in ops/ecosystem.config.cjs or root)
    eco_file = root / "ops" / "ecosystem.config.cjs"
    if eco_file.is_file():
        files["backend/ecosystem.config.cjs"] = eco_file

    return files


def create_release_package(
    commit: str,
    output_path: Path,
    root: Path | None = None,
    created_at: str | None = None,
) -> dict:
    repo_root = (root or Path(__file__).resolve().parent.parent).resolve()
    files_map = collect_package_files(repo_root)

    node_version = (repo_root / ".node-version").read_text().strip().removeprefix("v")
    manifest = build_manifest(commit, files_map, node_version, created_at)

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="lp-package-") as tmp_dir:
        tmp_manifest = Path(tmp_dir) / "release-manifest.json"
        tmp_manifest.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        files_map["release-manifest.json"] = tmp_manifest

        # Create reproducible tar.gz
        fixed_time = int(datetime.fromisoformat(manifest["created_at"]).timestamp())

        with tarfile.open(output_path, "w:gz") as tar:
            for rel_path, abs_path in sorted(files_map.items()):
                norm_rel = rel_path.replace("\\", "/")
                tarinfo = tar.gettarinfo(str(abs_path), arcname=norm_rel)
                tarinfo.uid = 0
                tarinfo.gid = 0
                tarinfo.uname = "root"
                tarinfo.gname = "root"
                tarinfo.mtime = fixed_time
                if tarinfo.isreg():
                    tarinfo.mode = 0o755 if (abs_path.stat().st_mode & 0o111) else 0o644
                with abs_path.open("rb") as f:
                    tar.addfile(tarinfo, f)

    pkg_sha256 = sha256_file(output_path)
    pkg_size = output_path.stat().st_size

    manifest["package_sha256"] = pkg_sha256
    manifest["package_size"] = pkg_size
    manifest["package_path"] = str(output_path.resolve())

    return manifest


def main():
    parser = argparse.ArgumentParser(description="Package runtime release for Layanan Pensiunan")
    parser.add_argument("--commit", required=True, help="Full 40-character hex commit SHA")
    parser.add_argument("--output", help="Path to output .tar.gz archive")
    parser.add_argument("--root", help="Root repository directory (default: parent of ops/)")
    parser.add_argument("--manifest-only", action="store_true", help="Print manifest without creating archive")
    args = parser.parse_args()

    root = Path(args.root).resolve() if args.root else Path(__file__).resolve().parent.parent

    if args.manifest_only:
        files_map = collect_package_files(root)
        node_version = (root / ".node-version").read_text().strip().removeprefix("v")
        manifest = build_manifest(args.commit, files_map, node_version)
        print(json.dumps(manifest, indent=2))
        return

    if not args.output:
        parser.error("--output is required unless --manifest-only is specified")

    out_path = Path(args.output).resolve()
    manifest = create_release_package(args.commit, out_path, root)
    print(json.dumps({
        "status": "package_created",
        "commit": manifest["commit"],
        "package_path": manifest["package_path"],
        "package_sha256": manifest["package_sha256"],
        "package_size": manifest["package_size"],
        "files_count": manifest["files_count"],
        "node_version": manifest["node_version"],
        "data_contract": manifest["data_contract"]
    }, indent=2))


if __name__ == "__main__":
    main()
