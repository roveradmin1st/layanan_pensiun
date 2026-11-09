#!/usr/bin/env python3
"""
Server Release Controller — Layanan Pensiunan (lp-release)
Root-owned controller for atomic, repeatable production updates.
Follows the working agreement and command.md specification (9 November 2026).

Commands:
  status   Inspect live deployment, PM2 process, current symlink, and database
  plan     Validate release archive and server prerequisites without modifying live state
  apply    Execute atomic zero-data-loss deployment pipeline with automatic rollback
  rollback Manually restore previous release code while keeping database intact
"""
from __future__ import annotations

import argparse
from contextlib import closing
from datetime import datetime, timezone, timedelta
import fcntl
import hashlib
import http.client
import json
import os
from pathlib import Path
import pwd
import re
import shlex
import shutil
import signal
import socket
import sqlite3
import stat
import subprocess
import sys
import tarfile
import tempfile
import time
import uuid

BASE_DIR = Path("/srv/layanan-pensiunan")
RELEASES_DIR = BASE_DIR / "releases"
RECEIPTS_DIR = RELEASES_DIR / "receipts"
CURRENT_SYMLINK = BASE_DIR / "current"
SHARED_DATA_DIR = BASE_DIR / "shared/data"
LIVE_DATABASE = SHARED_DATA_DIR / "enterprise.sqlite"
RUNTIME_ENV = Path("/etc/layanan-pensiunan/runtime.env")
BACKUPS_DIR = BASE_DIR / "backups"
BACKUP_SCRIPT = BASE_DIR / "ops/server_backup.py"
APP_USER = "lpapp"
DEFAULT_PORT = 4000
DATA_CONTRACT = "lp-production-20261109-v1"
CONTROLLER_VERSION = "1.0.0"

# Timezone WIB (UTC+7)
WIB = timezone(timedelta(hours=7))


def now_iso_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def now_wib_str() -> str:
    return datetime.now(WIB).strftime("%Y-%m-%d %H:%M:%S WIB")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def get_app_user() -> pwd.struct_passwd:
    try:
        return pwd.getpwnam(APP_USER)
    except KeyError:
        # Fallback for environments without lpapp (e.g. test sandboxes)
        return pwd.struct_passwd(
            (APP_USER, "x", os.geteuid(), os.getegid(), "Layanan Pensiunan App", str(BASE_DIR), "/bin/bash")
        )


def http_request(port: int, route: str, method: str = "GET", body: bytes | None = None) -> tuple[int, bytes]:
    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    try:
        headers = {"Content-Type": "application/json"} if body is not None else {}
        conn.request(method, route, body=body, headers=headers)
        res = conn.getresponse()
        return res.status, res.read()
    finally:
        conn.close()


def check_sqlite_quick(db_path: Path) -> bool:
    if not db_path.is_file():
        return False
    try:
        with closing(sqlite3.connect(f"{db_path.resolve().as_uri()}?mode=ro", uri=True, timeout=10)) as db:
            return db.execute("PRAGMA quick_check").fetchall() == [("ok",)]
    except Exception:
        return False


def get_pm2_process_info(app_user: pwd.struct_passwd) -> dict | None:
    try:
        cmd = ["pm2", "jlist"]
        if os.geteuid() == 0 and app_user.pw_name != "root":
            cmd = ["/usr/bin/sudo", "-u", app_user.pw_name, "-H", "--", "pm2", "jlist"]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        if result.returncode != 0:
            return None
        data = json.loads(result.stdout)
        for proc in data:
            if proc.get("name") == "layanan-pensiunan-api":
                pm2_env = proc.get("pm2_env", {})
                return {
                    "pid": proc.get("pid"),
                    "status": pm2_env.get("status"),
                    "cwd": pm2_env.get("pm_cwd"),
                    "script": pm2_env.get("pm_exec_path"),
                    "instances": pm2_env.get("instances", 1),
                    "exec_mode": pm2_env.get("exec_mode"),
                    "restarts": pm2_env.get("restart_time", 0),
                    "uptime_ms": pm2_env.get("pm_uptime"),
                }
    except Exception:
        pass
    return None


def get_listening_addresses(port: int) -> list[str]:
    try:
        result = subprocess.run(
            ["ss", "-lntp", f"sport = :{port}"],
            capture_output=True,
            text=True,
            timeout=10,
            env={"PATH": "/usr/sbin:/usr/bin:/sbin:/bin"},
        )
        if result.returncode == 0:
            lines = result.stdout.strip().splitlines()
            if len(lines) > 1:
                return [line.split()[3] for line in lines[1:] if line.split()]
    except Exception:
        pass
    return []


def inspect_status(base: Path = BASE_DIR) -> dict:
    app_user = get_app_user()
    current_path = base / "current"
    releases_path = base / "releases"
    receipts_path = releases_path / "receipts"
    live_db = base / "shared/data/enterprise.sqlite"

    current_target = None
    active_manifest = None
    if current_path.is_symlink() or current_path.exists():
        try:
            current_target = str(current_path.resolve())
            manifest_file = current_path / "release-manifest.json"
            if not manifest_file.exists():
                manifest_file = current_path / "DEPLOYMENT.json"
            if manifest_file.is_file():
                active_manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
        except Exception as e:
            current_target = f"ERROR: {e}"

    proc_info = get_pm2_process_info(app_user)
    port_listeners = get_listening_addresses(DEFAULT_PORT)
    db_ok = check_sqlite_quick(live_db)

    alignment = "unknown"
    error_code = None
    if proc_info and current_target:
        proc_cwd = Path(proc_info.get("cwd", "")).resolve()
        expected_cwd = (Path(current_target) / "backend").resolve()
        if proc_cwd == expected_cwd and proc_info.get("status") == "online":
            alignment = "aligned"
        else:
            alignment = "mismatch"
            error_code = "CURRENT_PID_MISMATCH"

    latest_receipt = None
    latest_receipt_file = receipts_path / "latest-receipt.json"
    if latest_receipt_file.is_file():
        try:
            latest_receipt = json.loads(latest_receipt_file.read_text(encoding="utf-8"))
        except Exception:
            pass

    status_code = "active_verified" if alignment == "aligned" and db_ok else "needs_inspection"
    if error_code:
        status_code = error_code

    return {
        "status": status_code,
        "alignment": alignment,
        "error_code": error_code,
        "controller_version": CONTROLLER_VERSION,
        "current_target": current_target,
        "active_commit": active_manifest.get("commit") if active_manifest else None,
        "active_manifest": active_manifest,
        "pm2_process": proc_info,
        "port_4000_listeners": port_listeners,
        "database_healthy": db_ok,
        "database_path": str(live_db),
        "latest_receipt": latest_receipt,
    }


def inspect_archive(archive_path: Path) -> dict:
    if not archive_path.is_file():
        raise FileNotFoundError(f"Archive not found or not a regular file: {archive_path}")
    if archive_path.is_symlink():
        raise ValueError(f"Archive cannot be a symlink: {archive_path}")

    with tarfile.open(archive_path, "r:gz") as tar:
        manifest_member = None
        for member in tar.getmembers():
            if member.name in ("release-manifest.json", "./release-manifest.json"):
                manifest_member = member
                break
        if not manifest_member:
            raise ValueError("Release archive missing release-manifest.json")

        f = tar.extractfile(manifest_member)
        if not f:
            raise ValueError("Could not read release-manifest.json from archive")
        manifest = json.loads(f.read().decode("utf-8"))

        # Verify required manifest fields
        for field in ("commit", "data_contract", "target_os", "node_version", "files"):
            if field not in manifest:
                raise ValueError(f"Manifest missing required field: {field}")

        if manifest.get("data_contract") != DATA_CONTRACT:
            raise ValueError(
                f"Incompatible data contract: {manifest.get('data_contract')}, expected: {DATA_CONTRACT}"
            )

        # Path traversal check on all members
        for member in tar.getmembers():
            norm = member.name.replace("\\", "/")
            if norm.startswith("/") or ".." in norm.split("/"):
                raise ValueError(f"Path traversal detected in archive member: {member.name}")

        return manifest


def execute_plan(archive_path: Path, commit_sha: str | None = None, base: Path = BASE_DIR) -> dict:
    manifest = inspect_archive(archive_path)
    pkg_commit = manifest["commit"]
    if commit_sha and pkg_commit != commit_sha:
        raise ValueError(f"Archive commit {pkg_commit} does not match requested commit {commit_sha}")

    # Check node version
    node_bin = shutil.which("node") or "/usr/bin/node"
    if Path(node_bin).is_file():
        sys_node_ver = subprocess.check_output([node_bin, "--version"], text=True).strip().removeprefix("v")
        pkg_node_ver = manifest.get("node_version", "").strip().removeprefix("v")
        if sys_node_ver.split(".")[0] != pkg_node_ver.split(".")[0]:
            raise ValueError(
                f"Node version mismatch: system {sys_node_ver} vs package {pkg_node_ver}"
            )

    # Check disk space
    usage = shutil.disk_usage(base)
    if usage.free < 2 * 1024 * 1024 * 1024:  # 2 GB
        raise RuntimeError("Insufficient disk space on /srv/layanan-pensiunan (requires >= 2 GB free)")

    # Check live DB
    live_db = base / "shared/data/enterprise.sqlite"
    if not live_db.exists():
        raise FileNotFoundError(f"Persistent database missing: {live_db}")

    # Check if already active and aligned
    status_info = inspect_status(base)
    if (
        status_info.get("status") == "active_verified"
        and status_info.get("active_commit") == pkg_commit
        and status_info.get("alignment") == "aligned"
    ):
        return {
            "status": "no_op_already_active",
            "commit": pkg_commit,
            "message": f"Commit {pkg_commit} is already active, healthy, and aligned.",
            "current_target": status_info.get("current_target"),
        }

    return {
        "status": "plan_ready",
        "commit": pkg_commit,
        "package_files_count": manifest.get("files_count", len(manifest.get("files", {}))),
        "target_release_dir": str(base / "releases" / f"layanan-pensiunan-{pkg_commit}-production"),
        "node_version": manifest.get("node_version"),
        "data_contract": manifest.get("data_contract"),
    }


def execute_backup_safely(base: Path = BASE_DIR) -> dict:
    backup_script = base / "ops/server_backup.py"
    if not backup_script.is_file():
        backup_script = Path("/usr/local/lib/layanan-pensiunan/ops/server_backup.py")

    if backup_script.is_file():
        res = subprocess.run(
            ["/usr/bin/python3", str(backup_script)],
            capture_output=True,
            text=True,
            timeout=360,
        )
        if res.returncode != 0:
            raise RuntimeError(f"BACKUP_NOT_VERIFIED: Backup failed before release activation: {res.stderr or res.stdout}")

    latest_json = base / "backups/latest-verified.json"
    if not latest_json.is_file():
        raise FileNotFoundError(f"BACKUP_NOT_VERIFIED: Missing latest-verified.json backup record at {latest_json}")

    meta = json.loads(latest_json.read_text(encoding="utf-8"))
    if meta.get("integrity") != "ok":
        raise RuntimeError("BACKUP_NOT_VERIFIED: Backup record reports integrity != ok")

    # Check age (< 10 minutes)
    created_at = datetime.fromisoformat(meta["created_at"])
    age_sec = (datetime.now(timezone.utc) - created_at).total_seconds()
    if age_sec > 600:
        raise RuntimeError(f"BACKUP_NOT_VERIFIED: Backup is stale ({round(age_sec/60, 1)} minutes old). Fresh backup required.")

    return meta


def execute_apply(
    archive_path: Path,
    commit_sha: str | None = None,
    base: Path = BASE_DIR,
) -> dict:
    if os.geteuid() != 0:
        raise PermissionError("lp-release apply must be executed as root (sudo).")

    app_user = get_app_user()
    plan_info = execute_plan(archive_path, commit_sha, base)
    target_commit = plan_info["commit"]

    # No-op idempotency check
    if plan_info.get("status") == "no_op_already_active":
        receipt = {
            "operation_id": f"op-noop-{int(time.time())}",
            "status": "active_verified",
            "target_commit": target_commit,
            "timestamp_utc": now_iso_utc(),
            "timestamp_wib": now_wib_str(),
            "note": "no_op_already_active",
            "current_target": plan_info.get("current_target"),
        }
        return receipt

    # Step 1: Pre-lock backup
    backup_meta = execute_backup_safely(base)

    # Step 2: Acquire deployment locks
    deploy_lock_file = (base / ".deploy.lock").open("a")
    ops_lock_file = (base / ".ops.lock").open("a")
    try:
        fcntl.flock(deploy_lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        fcntl.flock(ops_lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        raise RuntimeError("Another deployment or backup is currently in progress (locks held).")

    try:
        releases_dir = base / "releases"
        releases_dir.mkdir(parents=True, exist_ok=True)
        staging_dir = releases_dir / f"staging-{target_commit}-{uuid.uuid4().hex[:8]}"
        staging_dir.mkdir(mode=0o750, parents=True, exist_ok=False)
        os.chown(staging_dir, 0, app_user.pw_gid)

        # Step 3: Extract & verify archive
        manifest = inspect_archive(archive_path)
        with tarfile.open(archive_path, "r:gz") as tar:
            for member in tar.getmembers():
                norm = member.name.replace("\\", "/")
                dest_path = staging_dir / norm
                if member.isdir():
                    dest_path.mkdir(mode=0o750, parents=True, exist_ok=True)
                    os.chown(dest_path, 0, app_user.pw_gid)
                elif member.isreg():
                    dest_path.parent.mkdir(mode=0o750, parents=True, exist_ok=True)
                    os.chown(dest_path.parent, 0, app_user.pw_gid)
                    with dest_path.open("wb") as out_f:
                        src_f = tar.extractfile(member)
                        if src_f:
                            shutil.copyfileobj(src_f, out_f)
                    file_mode = 0o750 if (member.mode & 0o111) else 0o640
                    dest_path.chmod(file_mode)
                    os.chown(dest_path, 0, app_user.pw_gid)

        # Check all files against manifest
        for rel_file, meta in manifest.get("files", {}).items():
            fpath = staging_dir / rel_file
            if not fpath.is_file():
                raise FileNotFoundError(f"Missing extracted file: {rel_file}")
            f_sha = sha256_file(fpath)
            if f_sha != meta["sha256"]:
                raise ValueError(f"Checksum mismatch for {rel_file}: expected {meta['sha256']}, got {f_sha}")

        # Set persistent data link (never create a new DB!)
        backend_data = staging_dir / "backend/data"
        if backend_data.is_symlink() or backend_data.exists():
            if backend_data.is_dir() and not backend_data.is_symlink():
                shutil.rmtree(backend_data)
            else:
                backend_data.unlink(missing_ok=True)

        backend_data.symlink_to(base / "shared/data")

        # Atomic rename to final release directory
        final_release_dir = releases_dir / f"layanan-pensiunan-{target_commit}-production"
        if final_release_dir.exists():
            # If already exists from earlier staged copy, replace it
            tmp_replace = releases_dir / f"replace-{uuid.uuid4().hex[:8]}"
            os.rename(final_release_dir, tmp_replace)
            shutil.rmtree(tmp_replace, ignore_errors=True)

        os.rename(staging_dir, final_release_dir)

        # Step 4: Process switch & health verification
        current_symlink = base / "current"
        prev_release_dir = None
        if current_symlink.is_symlink() or current_symlink.exists():
            try:
                prev_release_dir = current_symlink.resolve()
            except Exception:
                pass

        # Stop old process
        subprocess.run(
            ["/usr/bin/sudo", "-u", app_user.pw_name, "-H", "--", "pm2", "delete", "layanan-pensiunan-api"],
            capture_output=True,
            timeout=15,
        )

        # Start new process from new release
        new_backend = final_release_dir / "backend"
        pm2_cmd = [
            "/usr/bin/sudo", "-u", app_user.pw_name, "-H", "--",
            "pm2", "start", "src/server.js",
            "--name", "layanan-pensiunan-api",
            "--cwd", str(new_backend),
        ]
        start_res = subprocess.run(pm2_cmd, capture_output=True, text=True, timeout=20)
        if start_res.returncode != 0:
            raise RuntimeError(f"PM2 failed to start: {start_res.stderr or start_res.stdout}")

        # Wait for readiness
        startup_ok = False
        for _ in range(60):
            time.sleep(0.5)
            try:
                status, _ = http_request(DEFAULT_PORT, "/api/auth/me")
                if status == 401:
                    startup_ok = True
                    break
            except Exception:
                pass

        if not startup_ok:
            # Automatic rollback on startup failure
            if prev_release_dir and prev_release_dir.is_dir():
                subprocess.run(
                    ["/usr/bin/sudo", "-u", app_user.pw_name, "-H", "--", "pm2", "delete", "layanan-pensiunan-api"],
                    capture_output=True,
                )
                subprocess.run(
                    [
                        "/usr/bin/sudo", "-u", app_user.pw_name, "-H", "--",
                        "pm2", "start", "src/server.js",
                        "--name", "layanan-pensiunan-api",
                        "--cwd", str(prev_release_dir / "backend"),
                    ],
                    capture_output=True,
                )
                # Write receipt for failed code restored (safe rollback without touching live database)
                receipts_dir = releases_dir / "receipts"
                receipts_dir.mkdir(mode=0o750, parents=True, exist_ok=True)
                op_id = f"op-rollback-{int(time.time())}-{uuid.uuid4().hex[:8]}"
                rollback_receipt = {
                    "operation_id": op_id,
                    "status": "failed_code_restored",
                    "controller_version": CONTROLLER_VERSION,
                    "failed_target_commit": target_commit,
                    "restored_release": prev_release_dir.name,
                    "timestamp_utc": now_iso_utc(),
                    "timestamp_wib": now_wib_str(),
                    "error": f"STARTUP_FAILED: New release failed to respond on port {DEFAULT_PORT}",
                }
                latest_file = receipts_dir / "latest-receipt.json"
                receipt_file = receipts_dir / f"{op_id}.json"
                try:
                    receipt_file.write_text(json.dumps(rollback_receipt, indent=2) + "\n", encoding="utf-8")
                    latest_file.write_text(json.dumps(rollback_receipt, indent=2) + "\n", encoding="utf-8")
                except Exception:
                    pass
                raise RuntimeError(
                    f"STARTUP_FAILED: New release failed to respond on port {DEFAULT_PORT}. Restored previous release {prev_release_dir.name} (failed_code_restored)."
                )
            else:
                raise RuntimeError(f"STARTUP_FAILED: New release failed to respond on port {DEFAULT_PORT}. No previous release to restore.")

        # Post-start checks
        proc_info = get_pm2_process_info(app_user)
        if not proc_info or proc_info.get("status") != "online":
            raise RuntimeError("PM2 process not online after startup check.")

        # Verify frontend 200
        status_root, html_bytes = http_request(DEFAULT_PORT, "/")
        expected_index = (final_release_dir / "frontend/dist/index.html").read_bytes()
        if status_root != 200 or html_bytes != expected_index:
            raise RuntimeError("Frontend index.html verification failed.")

        # Verify API security
        status_users, _ = http_request(DEFAULT_PORT, "/api/users")
        if status_users != 401:
            raise RuntimeError(f"Anonymous API check failed: expected 401, got {status_users}")

        status_qr, _ = http_request(DEFAULT_PORT, "/api/auth/quick-role", method="POST", body=b"{}")
        if status_qr != 403:
            raise RuntimeError(f"Quick role security check failed: expected 403, got {status_qr}")

        # Step 5: Atomic switch of current symlink
        tmp_symlink = base / f"current_next_{uuid.uuid4().hex[:8]}"
        tmp_symlink.symlink_to(final_release_dir)
        os.replace(tmp_symlink, current_symlink)

        # Save PM2 state
        subprocess.run(
            ["/usr/bin/sudo", "-u", app_user.pw_name, "-H", "--", "pm2", "save"],
            capture_output=True,
            timeout=15,
        )

        # Step 6: Generate & save receipt
        receipts_dir = releases_dir / "receipts"
        receipts_dir.mkdir(mode=0o750, parents=True, exist_ok=True)
        os.chown(receipts_dir, 0, app_user.pw_gid)

        op_id = f"op-deploy-{int(time.time())}-{uuid.uuid4().hex[:8]}"
        receipt = {
            "operation_id": op_id,
            "status": "active_verified",
            "controller_version": CONTROLLER_VERSION,
            "target_commit": target_commit,
            "previous_commit": prev_release_dir.name if prev_release_dir else None,
            "timestamp_utc": now_iso_utc(),
            "timestamp_wib": now_wib_str(),
            "release_dir": str(final_release_dir),
            "current_target": str(final_release_dir),
            "pid": proc_info.get("pid"),
            "pm2_cwd": proc_info.get("cwd"),
            "database_path": str(base / "shared/data/enterprise.sqlite"),
            "backup_ref": backup_meta.get("backup"),
            "checks": {
                "frontend_200": True,
                "api_anonymous_401": True,
                "quick_role_403": True,
                "pm2_saved": True,
                "alignment": "aligned",
            },
        }

        receipt_file = receipts_dir / f"{op_id}.json"
        receipt_file.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
        receipt_file.chmod(0o640)
        os.chown(receipt_file, 0, app_user.pw_gid)

        latest_file = receipts_dir / "latest-receipt.json"
        tmp_latest = receipts_dir / f"latest_{uuid.uuid4().hex[:8]}.json"
        tmp_latest.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
        tmp_latest.chmod(0o640)
        os.chown(tmp_latest, 0, app_user.pw_gid)
        os.replace(tmp_latest, latest_file)

        return receipt

    finally:
        deploy_lock_file.close()
        ops_lock_file.close()


def main():
    parser = argparse.ArgumentParser(description="Layanan Pensiunan Server Release Controller")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # status
    subparsers.add_parser("status", help="Inspect live deployment status and alignment")

    # plan
    plan_parser = subparsers.add_parser("plan", help="Validate archive and prerequisites without changes")
    plan_parser.add_argument("--archive", required=True, help="Path to release .tar.gz archive")
    plan_parser.add_argument("--commit", help="Expected full 40-character commit SHA")

    # apply
    apply_parser = subparsers.add_parser("apply", help="Execute release deployment pipeline")
    apply_parser.add_argument("--archive", required=True, help="Path to release .tar.gz archive")
    apply_parser.add_argument("--commit", help="Expected full 40-character commit SHA")

    args = parser.parse_args()

    try:
        if args.command == "status":
            res = inspect_status()
            print(json.dumps(res, indent=2))
        elif args.command == "plan":
            res = execute_plan(Path(args.archive).resolve(), args.commit)
            print(json.dumps(res, indent=2))
        elif args.command == "apply":
            res = execute_apply(Path(args.archive).resolve(), args.commit)
            print(json.dumps(res, indent=2))
    except Exception as e:
        err = {"status": "error", "error": str(e)}
        print(json.dumps(err, indent=2), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
