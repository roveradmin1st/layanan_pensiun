#!/usr/bin/env python3
"""
Server Release Controller — Layanan Pensiunan (lp-release)
Root-owned controller for atomic, repeatable production updates.
Follows the working agreement and command.md specification (9 November 2026).

Commands:
  status   Inspect live deployment, PM2 process, current symlink, and database
  plan     Validate release archive and server prerequisites without modifying live state
  apply    Execute atomic zero-data-loss deployment pipeline with automatic rollback
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
import sqlite3
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
APP_NAME = "layanan-pensiunan-api"
DEFAULT_PORT = 4000
DATA_CONTRACT = "lp-production-20261109-v1"
CONTROLLER_VERSION = "1.1.0"

FORBIDDEN_ENV_KEYS = frozenset({
    "NODE_OPTIONS",
    "NODE_PATH",
    "BASH_ENV",
    "ENV",
    "LD_PRELOAD",
    "LD_LIBRARY_PATH",
})

REQUIRED_PACKAGE_FILES = frozenset({
    ".node-version",
    "backend/src/server.js",
    "backend/package.json",
    "backend/package-lock.json",
    "backend/ecosystem.config.cjs",
    "frontend/dist/index.html",
})

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


def sync_dir(path: Path) -> None:
    try:
        fd = os.open(path, os.O_DIRECTORY)
    except OSError:
        return
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def require_root() -> None:
    if os.geteuid() != 0:
        raise PermissionError("lp-release apply must be executed as root (sudo).")


def set_owner(path: Path | int, uid: int, gid: int) -> None:
    if isinstance(path, int):
        os.fchown(path, uid, gid)
    else:
        os.chown(path, uid, gid)


def atomic_write_json(
    path: Path,
    payload: dict | list,
    mode: int = 0o640,
    uid: int = 0,
    gid: int = 0,
) -> None:
    path.parent.mkdir(mode=0o750, parents=True, exist_ok=True)
    set_owner(path.parent, uid, gid)
    raw = (json.dumps(payload, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            os.fchmod(stream.fileno(), mode)
            set_owner(stream.fileno(), uid, gid)
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(tmp_name, path)
        sync_dir(path.parent)
    finally:
        Path(tmp_name).unlink(missing_ok=True)


def get_app_user(base: Path = BASE_DIR) -> pwd.struct_passwd:
    try:
        return pwd.getpwnam(APP_USER)
    except KeyError:
        return pwd.struct_passwd(
            (APP_USER, "x", os.geteuid(), os.getegid(), "Layanan Pensiunan App", str(base / "service-home"), "/bin/bash")
        )


def parse_runtime_env(text: str) -> dict[str, str]:
    values: dict[str, str] = {}
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        parts = shlex.split(line, comments=True)
        if parts and parts[0] == "export":
            parts = parts[1:]
        if len(parts) != 1 or "=" not in parts[0]:
            raise RuntimeError("RUNTIME_MISMATCH: Invalid syntax in runtime.env.")
        key, value = parts[0].split("=", 1)
        if not re.fullmatch(r"[A-Z_][A-Z0-9_]*", key):
            raise RuntimeError(f"RUNTIME_MISMATCH: Invalid environment variable name '{key}' in runtime.env.")
        if key in values:
            raise RuntimeError(f"RUNTIME_MISMATCH: Duplicate environment variable '{key}' in runtime.env.")
        if key in FORBIDDEN_ENV_KEYS:
            raise RuntimeError(f"RUNTIME_MISMATCH: Forbidden environment variable '{key}' in runtime.env.")
        values[key] = value

    if values.get("NODE_ENV") != "production":
        raise RuntimeError("RUNTIME_MISMATCH: runtime.env must set NODE_ENV=production.")
    if values.get("HOST") != "127.0.0.1":
        raise RuntimeError("RUNTIME_MISMATCH: runtime.env must set HOST=127.0.0.1.")
    if values.get("PORT") != str(DEFAULT_PORT):
        raise RuntimeError(f"RUNTIME_MISMATCH: runtime.env must set PORT={DEFAULT_PORT}.")
    if len(values.get("JWT_SECRET", "").strip()) < 32:
        raise RuntimeError("RUNTIME_MISMATCH: runtime.env must define a valid JWT_SECRET (>= 32 chars).")

    values.setdefault("TZ", "Asia/Jakarta")
    return values


def load_runtime_env(
    env_path: Path = RUNTIME_ENV,
    app_user: pwd.struct_passwd | None = None,
    check_permissions: bool = True,
) -> dict[str, str]:
    if not env_path.is_file() or env_path.is_symlink():
        raise RuntimeError(f"RUNTIME_MISMATCH: Missing or symlinked runtime.env at {env_path}.")
    if check_permissions and os.geteuid() == 0 and app_user is not None:
        info = env_path.stat()
        if info.st_uid != 0 or info.st_gid != app_user.pw_gid or (info.st_mode & 0o777) != 0o640:
            raise RuntimeError("RUNTIME_MISMATCH: runtime.env must be owned by root:lpapp with mode 0640.")
    return parse_runtime_env(env_path.read_text(encoding="utf-8"))


def build_app_env(runtime_vars: dict[str, str], app_user: pwd.struct_passwd) -> dict[str, str]:
    return {
        **runtime_vars,
        "PATH": "/usr/local/bin:/usr/bin:/bin",
        "HOME": app_user.pw_dir,
        "USER": app_user.pw_name,
        "LOGNAME": app_user.pw_name,
        "PM2_HOME": str(Path(app_user.pw_dir) / ".pm2"),
        "TZ": runtime_vars.get("TZ", "Asia/Jakarta"),
    }


def get_pm2_binary() -> str:
    pm2_bin = shutil.which("pm2", path="/usr/local/bin:/usr/bin:/bin") or shutil.which("pm2")
    if not pm2_bin:
        raise RuntimeError("RUNTIME_MISMATCH: pm2 binary not found in /usr/local/bin:/usr/bin:/bin.")
    return pm2_bin


def get_system_node_version(node_bin: str = "/usr/bin/node") -> str:
    resolved = node_bin if Path(node_bin).is_file() else (shutil.which("node", path="/usr/local/bin:/usr/bin:/bin") or shutil.which("node"))
    if not resolved or not Path(resolved).is_file():
        raise RuntimeError("RUNTIME_MISMATCH: Node binary not found.")
    res = subprocess.run(
        [resolved, "--version"],
        stdin=subprocess.DEVNULL,
        capture_output=True,
        text=True,
        timeout=10,
        env={"PATH": "/usr/local/bin:/usr/bin:/bin"},
    )
    if res.returncode != 0:
        raise RuntimeError("RUNTIME_MISMATCH: Failed to execute node --version.")
    ver = res.stdout.strip().removeprefix("v")
    if not ver:
        raise RuntimeError("RUNTIME_MISMATCH: Empty output from node --version.")
    return ver


def run_as_app(
    args: list[str],
    app_user: pwd.struct_passwd,
    app_env: dict[str, str] | None = None,
    *,
    timeout: int = 30,
    check: bool = True,
) -> subprocess.CompletedProcess:
    env = app_env or {
        "PATH": "/usr/local/bin:/usr/bin:/bin",
        "HOME": app_user.pw_dir,
        "USER": app_user.pw_name,
        "LOGNAME": app_user.pw_name,
        "PM2_HOME": str(Path(app_user.pw_dir) / ".pm2"),
        "TZ": "Asia/Jakarta",
    }
    cwd = app_user.pw_dir if Path(app_user.pw_dir).is_dir() else "/"
    identity = (
        {"user": app_user.pw_uid, "group": app_user.pw_gid, "extra_groups": []}
        if os.geteuid() == 0 and app_user.pw_uid != 0
        else {}
    )
    res = subprocess.run(
        [str(a) for a in args],
        cwd=cwd,
        env=env,
        stdin=subprocess.DEVNULL,
        capture_output=True,
        text=True,
        timeout=timeout,
        **identity,
    )
    if check and res.returncode != 0:
        raise RuntimeError(f"App command {args[0]} failed with exit code {res.returncode}.")
    return res


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
    if not db_path.is_file() or db_path.is_symlink():
        return False
    try:
        with closing(sqlite3.connect(f"{db_path.resolve(strict=True).as_uri()}?mode=ro", uri=True, timeout=10)) as db:
            return db.execute("PRAGMA quick_check").fetchall() == [("ok",)]
    except Exception:
        return False


def get_pm2_process_info(app_user: pwd.struct_passwd, app_env: dict[str, str] | None = None) -> dict | None:
    try:
        pm2_bin = get_pm2_binary()
        result = run_as_app([pm2_bin, "jlist"], app_user, app_env, timeout=15, check=False)
        if result.returncode != 0:
            return None
        data = json.loads(result.stdout)
        matching = [proc for proc in data if proc.get("name") == APP_NAME]
        if not matching:
            return None
        if len(matching) > 1:
            return {
                "pid": matching[0].get("pid"),
                "status": "multiple_instances",
                "count": len(matching),
                "cwd": matching[0].get("pm2_env", {}).get("pm_cwd"),
                "script": matching[0].get("pm2_env", {}).get("pm_exec_path"),
                "instances": len(matching),
                "exec_mode": matching[0].get("pm2_env", {}).get("exec_mode"),
            }
        proc = matching[0]
        pm2_env = proc.get("pm2_env", {})
        pid = proc.get("pid")
        info = {
            "pid": pid,
            "status": pm2_env.get("status"),
            "count": 1,
            "cwd": pm2_env.get("pm_cwd"),
            "script": pm2_env.get("pm_exec_path"),
            "instances": pm2_env.get("instances", 1),
            "exec_mode": pm2_env.get("exec_mode"),
            "restarts": pm2_env.get("restart_time", 0),
            "uptime_ms": pm2_env.get("pm_uptime"),
        }
        if pid and Path(f"/proc/{pid}").exists():
            try:
                proc_dir = Path(f"/proc/{pid}")
                info["proc_uid"] = proc_dir.stat().st_uid
                info["proc_cwd"] = str((proc_dir / "cwd").resolve(strict=True))
            except Exception:
                pass
        return info
    except Exception:
        return None


def check_saved_list(entries: list, expected_release: Path) -> None:
    if not isinstance(entries, list) or len(entries) != 1:
        raise RuntimeError(f"PM2 saved list must contain exactly 1 app, found {len(entries) if isinstance(entries, list) else 'invalid'}.")
    entry = entries[0]
    if entry.get("name") != APP_NAME:
        raise RuntimeError(f"PM2 saved list app name mismatch: {entry.get('name')}.")
    if entry.get("exec_mode") not in ("fork_mode", "fork") or entry.get("instances", 1) != 1:
        raise RuntimeError("PM2 saved list must be single-instance fork mode.")
    if entry.get("status", "online") != "online":
        raise RuntimeError(f"PM2 saved list status is not online: {entry.get('status')}.")
    expected_cwd = (expected_release / "backend").resolve(strict=True)
    expected_script = (expected_release / "backend/src/server.js").resolve(strict=True)
    actual_cwd = Path(entry.get("pm_cwd", "")).resolve(strict=True)
    actual_script = Path(entry.get("pm_exec_path", "")).resolve(strict=True)
    if actual_cwd != expected_cwd or actual_script != expected_script:
        raise RuntimeError(
            f"PM2 saved list points to {actual_cwd} instead of expected {expected_cwd}."
        )


def verify_saved_pm2(app_user: pwd.struct_passwd, expected_release: Path) -> None:
    dump_path = Path(app_user.pw_dir) / ".pm2/dump.pm2"
    if not dump_path.is_file() or dump_path.is_symlink():
        raise RuntimeError(f"PM2 dump file missing or symlinked at {dump_path}.")
    entries = json.loads(dump_path.read_text(encoding="utf-8"))
    check_saved_list(entries, expected_release)


def get_listening_addresses(port: int) -> list[str]:
    try:
        result = subprocess.run(
            ["ss", "-lntp", f"sport = :{port}"],
            stdin=subprocess.DEVNULL,
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
    app_user = get_app_user(base)
    current_path = base / "current"
    releases_path = base / "releases"
    receipts_path = releases_path / "receipts"
    live_db = base / "shared/data/enterprise.sqlite"

    current_target = None
    active_manifest = None
    if current_path.is_symlink() or current_path.exists():
        try:
            resolved_current = current_path.resolve(strict=True)
            current_target = str(resolved_current)
            manifest_file = resolved_current / "release-manifest.json"
            if not manifest_file.exists():
                manifest_file = resolved_current / "DEPLOYMENT.json"
            if manifest_file.is_file():
                active_manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
        except Exception as e:
            current_target = f"ERROR: {e}"

    proc_info = get_pm2_process_info(app_user)
    port_listeners = get_listening_addresses(DEFAULT_PORT)
    db_ok = check_sqlite_quick(live_db)

    alignment = "unknown"
    error_code = None
    diagnosis = None

    if proc_info and current_target and not current_target.startswith("ERROR:"):
        try:
            proc_cwd = Path(proc_info.get("cwd", "")).resolve()
            expected_cwd = (Path(current_target) / "backend").resolve()
            proc_os_cwd_ok = (
                Path(proc_info["proc_cwd"]).resolve() == expected_cwd
                if "proc_cwd" in proc_info
                else True
            )
            proc_uid_ok = (
                proc_info["proc_uid"] == app_user.pw_uid
                if "proc_uid" in proc_info
                else True
            )
            mode_ok = proc_info.get("exec_mode") in ("fork_mode", "fork", None) and proc_info.get("instances", 1) == 1 and proc_info.get("count", 1) == 1
            port_ok = port_listeners == [f"127.0.0.1:{DEFAULT_PORT}"]
            if (
                proc_cwd == expected_cwd
                and proc_os_cwd_ok
                and proc_uid_ok
                and proc_info.get("status") == "online"
                and proc_info.get("pid", 0) > 0
                and mode_ok
                and port_ok
            ):
                alignment = "aligned"
            else:
                alignment = "mismatch"
                error_code = "CURRENT_PID_MISMATCH"
                diagnosis = (
                    f"CURRENT_PID_MISMATCH: current points to '{Path(current_target).name}', "
                    f"while PM2 process (status={proc_info.get('status')}, pid={proc_info.get('pid')}) "
                    f"runs from '{proc_cwd}' (port_4000={port_listeners})."
                )
        except Exception as exc:
            alignment = "mismatch"
            error_code = "CURRENT_PID_MISMATCH"
            diagnosis = f"CURRENT_PID_MISMATCH: Failed to resolve process/current alignment: {exc}"
    elif current_target or proc_info:
        alignment = "mismatch"
        error_code = "CURRENT_PID_MISMATCH"
        diagnosis = (
            f"CURRENT_PID_MISMATCH: current={current_target}, pm2_process={proc_info}."
        )

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
        "diagnosis": diagnosis,
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
        raise FileNotFoundError(f"INVALID_ARTIFACT: Archive not found or not a regular file: {archive_path}")
    if archive_path.is_symlink():
        raise ValueError(f"INVALID_ARTIFACT: Archive cannot be a symlink: {archive_path}")

    with tarfile.open(archive_path, "r:gz") as tar:
        manifest_member = None
        for member in tar.getmembers():
            norm = member.name.replace("\\", "/").lstrip("./")
            if member.name.startswith("/") or ".." in member.name.replace("\\", "/").split("/"):
                raise ValueError(f"INVALID_ARTIFACT: Path traversal detected in archive member: {member.name}")
            if member.issym() or member.islnk() or member.ischr() or member.isblk() or member.isfifo() or member.isdev():
                raise ValueError(f"INVALID_ARTIFACT: Forbidden special or link entry in archive: {member.name}")
            if norm == "release-manifest.json":
                manifest_member = member

        if not manifest_member:
            raise ValueError("INVALID_ARTIFACT: Release archive missing release-manifest.json")

        f = tar.extractfile(manifest_member)
        if not f:
            raise ValueError("INVALID_ARTIFACT: Could not read release-manifest.json from archive")
        manifest = json.loads(f.read().decode("utf-8"))

        for field in ("commit", "data_contract", "target_os", "node_version", "files"):
            if field not in manifest:
                raise ValueError(f"INVALID_ARTIFACT: Manifest missing required field: {field}")

        if not re.fullmatch(r"[0-9a-f]{40}", str(manifest.get("commit", ""))):
            raise ValueError(f"INVALID_ARTIFACT: Manifest commit is not a valid 40-hex SHA: {manifest.get('commit')}")

        if manifest.get("data_contract") != DATA_CONTRACT:
            raise ValueError(
                f"INVALID_ARTIFACT: Incompatible data contract: {manifest.get('data_contract')}, expected: {DATA_CONTRACT}"
            )

        manifest_files = set(manifest.get("files", {}).keys())
        missing_required = REQUIRED_PACKAGE_FILES - manifest_files
        if missing_required:
            raise ValueError(f"INVALID_ARTIFACT: Package missing required runtime files: {sorted(missing_required)}")

        return manifest


def check_release_compatible(release_dir: Path | None) -> bool:
    if not release_dir or not release_dir.is_dir():
        return False
    if not (release_dir / "backend/src/server.js").is_file() or not (release_dir / "frontend/dist/index.html").is_file():
        return False
    for name in ("release-manifest.json", "DEPLOYMENT.json"):
        mpath = release_dir / name
        if mpath.is_file():
            try:
                data = json.loads(mpath.read_text(encoding="utf-8"))
                contract = data.get("data_contract")
                if contract and contract != DATA_CONTRACT:
                    return False
                return True
            except Exception:
                return False
    return False


def execute_plan(
    archive_path: Path,
    commit_sha: str | None = None,
    base: Path = BASE_DIR,
    runtime_env_path: Path = RUNTIME_ENV,
) -> dict:
    manifest = inspect_archive(archive_path)
    pkg_commit = manifest["commit"]
    if commit_sha and pkg_commit != commit_sha:
        raise ValueError(f"INVALID_ARTIFACT: Archive commit {pkg_commit} does not match requested commit {commit_sha}")

    # Check exact Node version match
    sys_node_ver = get_system_node_version()
    pkg_node_ver = str(manifest.get("node_version", "")).strip().removeprefix("v")
    if not sys_node_ver or not pkg_node_ver or sys_node_ver != pkg_node_ver:
        raise ValueError(
            f"RUNTIME_MISMATCH: Node version mismatch: system {sys_node_ver} vs package {pkg_node_ver}"
        )

    # Validate runtime.env configuration
    app_user = get_app_user(base)
    load_runtime_env(runtime_env_path, app_user, check_permissions=(os.geteuid() == 0))

    # Check disk space (>= 2 GB)
    usage = shutil.disk_usage(base)
    if usage.free < 2 * 1024 * 1024 * 1024:
        raise RuntimeError("Insufficient disk space on /srv/layanan-pensiunan (requires >= 2 GB free)")

    # Check persistent SQLite DB
    live_db = base / "shared/data/enterprise.sqlite"
    if not live_db.exists():
        raise FileNotFoundError(f"Persistent database missing: {live_db}")
    if not check_sqlite_quick(live_db):
        raise RuntimeError(f"Persistent database failed quick_check integrity test: {live_db}")

    # Inspect live deployment status & enforce strict alignment before allowing routine update
    status_info = inspect_status(base)
    if status_info.get("error_code") == "CURRENT_PID_MISMATCH" or status_info.get("alignment") != "aligned":
        raise RuntimeError(
            status_info.get("diagnosis")
            or f"CURRENT_PID_MISMATCH [phase=plan]: current ({status_info.get('current_target')}) and PM2 process are not aligned."
        )

    # Check if target commit is already active, aligned, saved, and serving traffic
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
        "previous_commit": status_info.get("active_commit"),
        "previous_release_dir": status_info.get("current_target"),
        "package_files_count": manifest.get("files_count", len(manifest.get("files", {}))),
        "target_release_dir": str(base / "releases" / f"layanan-pensiunan-{pkg_commit}-production"),
        "node_version": manifest.get("node_version"),
        "data_contract": manifest.get("data_contract"),
    }


def verify_backup_record(base: Path = BASE_DIR) -> dict:
    latest_json = base / "backups/latest-verified.json"
    if not latest_json.is_file() or latest_json.is_symlink():
        raise FileNotFoundError(f"BACKUP_NOT_VERIFIED: Missing latest-verified.json backup record at {latest_json}")

    meta = json.loads(latest_json.read_text(encoding="utf-8"))
    if meta.get("integrity") != "ok":
        raise RuntimeError("BACKUP_NOT_VERIFIED: Backup record reports integrity != ok")

    created_at = datetime.fromisoformat(meta["created_at"])
    age_sec = (datetime.now(timezone.utc) - created_at).total_seconds()
    if age_sec > 600:
        raise RuntimeError(f"BACKUP_NOT_VERIFIED: Backup is stale ({round(age_sec/60, 1)} minutes old). Fresh backup required.")

    backup_file = Path(meta.get("backup", ""))
    if backup_file.is_file() and "sha256" in meta:
        if sha256_file(backup_file) != meta["sha256"]:
            raise RuntimeError("BACKUP_NOT_VERIFIED: Backup file sha256 mismatch.")

    return meta


def execute_backup_safely(base: Path = BASE_DIR) -> dict:
    backup_script = base / "ops/server_backup.py"
    if not backup_script.is_file():
        backup_script = Path("/usr/local/lib/layanan-pensiunan/ops/server_backup.py")

    if backup_script.is_file():
        res = subprocess.run(
            ["/usr/bin/python3", "-I", str(backup_script)],
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            timeout=360,
        )
        if res.returncode != 0:
            raise RuntimeError(f"BACKUP_NOT_VERIFIED: Backup script failed with exit code {res.returncode}")
        try:
            out_data = json.loads(res.stdout)
            if out_data.get("status") == "skipped":
                raise RuntimeError("BACKUP_NOT_VERIFIED: Backup script returned skipped (lock busy).")
        except json.JSONDecodeError:
            pass

    return verify_backup_record(base)


def stop_pm2_release(app_user: pwd.struct_passwd, app_env: dict[str, str]) -> None:
    pm2_bin = get_pm2_binary()
    proc_before = get_pm2_process_info(app_user, app_env)
    del_res = run_as_app([pm2_bin, "delete", APP_NAME], app_user, app_env, timeout=20, check=False)
    if proc_before is not None and del_res.returncode != 0:
        raise RuntimeError(f"PM2 stop/delete failed with exit code {del_res.returncode}.")

    for _ in range(30):
        listeners = get_listening_addresses(DEFAULT_PORT)
        if not listeners:
            return
        time.sleep(0.25)
    raise RuntimeError(f"Port {DEFAULT_PORT} is still in use after stopping PM2.")


def start_pm2_release(
    release_dir: Path,
    base: Path,
    app_user: pwd.struct_passwd,
    runtime_vars: dict[str, str],
    app_env: dict[str, str],
) -> None:
    pm2_bin = get_pm2_binary()
    control_dir = base / "control"
    control_dir.mkdir(mode=0o750, parents=True, exist_ok=True)
    if control_dir.is_symlink():
        raise RuntimeError("Control directory must not be a symlink.")
    set_owner(control_dir, 0, app_user.pw_gid)
    os.chmod(control_dir, 0o750)

    config_path = control_dir / f"pm2-{release_dir.name}.private.json"
    app_config = {
        "apps": [
            {
                "name": APP_NAME,
                "script": str((release_dir / "backend/src/server.js").resolve(strict=True)),
                "cwd": str((release_dir / "backend").resolve(strict=True)),
                "interpreter": "/usr/bin/node",
                "instances": 1,
                "exec_mode": "fork",
                "watch": False,
                "autorestart": True,
                "max_memory_restart": "500M",
                "kill_timeout": 5000,
                "wait_ready": False,
                "env": {
                    k: v
                    for k, v in runtime_vars.items()
                    if k not in ("HOME", "USER", "LOGNAME", "PM2_HOME", "PATH")
                },
            }
        ]
    }
    atomic_write_json(config_path, app_config, mode=0o640, uid=0, gid=app_user.pw_gid)
    try:
        run_as_app([pm2_bin, "start", str(config_path), "--update-env"], app_user, app_env, timeout=25, check=True)
    finally:
        config_path.unlink(missing_ok=True)


def wait_and_verify_release(
    release_dir: Path,
    base: Path,
    app_user: pwd.struct_passwd,
    app_env: dict[str, str],
) -> dict:
    expected_cwd = (release_dir / "backend").resolve(strict=True)
    expected_db = (base / "shared/data/enterprise.sqlite").resolve(strict=True)
    actual_db = (expected_cwd / "data/enterprise.sqlite").resolve(strict=True)
    if actual_db != expected_db:
        raise RuntimeError(f"Release database link mismatch: {actual_db} != {expected_db}")

    startup_ok = False
    for _ in range(60):
        try:
            status, _ = http_request(DEFAULT_PORT, "/api/auth/me")
            if status == 401:
                startup_ok = True
                break
        except Exception:
            pass
        time.sleep(0.25)

    if not startup_ok:
        raise RuntimeError(f"STARTUP_FAILED: Release {release_dir.name} failed readiness check on port {DEFAULT_PORT}.")

    proc_info = get_pm2_process_info(app_user, app_env)
    if not proc_info or proc_info.get("status") != "online" or proc_info.get("count", 1) != 1:
        raise RuntimeError("STARTUP_FAILED: PM2 process is not a single online instance after startup.")
    if proc_info.get("exec_mode") not in ("fork_mode", "fork", None) or proc_info.get("instances", 1) != 1:
        raise RuntimeError("STARTUP_FAILED: PM2 process is not running in single fork mode.")
    if Path(proc_info.get("cwd", "")).resolve() != expected_cwd:
        raise RuntimeError(
            f"STARTUP_FAILED: PM2 working directory {proc_info.get('cwd')} does not match {expected_cwd}."
        )
    if get_listening_addresses(DEFAULT_PORT) != [f"127.0.0.1:{DEFAULT_PORT}"]:
        raise RuntimeError(f"STARTUP_FAILED: Port {DEFAULT_PORT} listener is not strictly 127.0.0.1:{DEFAULT_PORT}.")

    status_root, html_bytes = http_request(DEFAULT_PORT, "/")
    expected_index = (release_dir / "frontend/dist/index.html").read_bytes()
    if status_root != 200 or html_bytes != expected_index:
        raise RuntimeError(f"STARTUP_FAILED: Frontend index.html verification failed (HTTP {status_root}).")

    status_users, _ = http_request(DEFAULT_PORT, "/api/users")
    if status_users != 401:
        raise RuntimeError(f"STARTUP_FAILED: Anonymous API check failed: expected 401, got {status_users}.")

    status_qr, _ = http_request(DEFAULT_PORT, "/api/auth/quick-role", method="POST", body=b"{}")
    if status_qr != 403:
        raise RuntimeError(f"STARTUP_FAILED: Quick-role security check failed: expected 403, got {status_qr}.")

    return proc_info


def point_current_symlink(base: Path, target_release: Path) -> None:
    current_symlink = base / "current"
    tmp_symlink = base / f"current_next_{uuid.uuid4().hex[:8]}"
    tmp_symlink.symlink_to(target_release)
    try:
        os.replace(tmp_symlink, current_symlink)
        sync_dir(base)
    finally:
        tmp_symlink.unlink(missing_ok=True)


def save_and_verify_pm2(
    expected_release: Path,
    base: Path,
    app_user: pwd.struct_passwd,
    app_env: dict[str, str],
) -> dict:
    pm2_bin = get_pm2_binary()
    run_as_app([pm2_bin, "save"], app_user, app_env, timeout=15, check=True)
    verify_saved_pm2(app_user, expected_release)

    post_status = inspect_status(base)
    if (
        post_status.get("status") != "active_verified"
        or post_status.get("alignment") != "aligned"
        or Path(post_status.get("current_target", "")).resolve() != expected_release.resolve()
    ):
        raise RuntimeError(
            f"Post-activation verification failed: status={post_status.get('status')}, alignment={post_status.get('alignment')}."
        )
    return post_status


def write_receipt(base: Path, app_user: pwd.struct_passwd, receipt: dict) -> None:
    receipts_dir = base / "releases/receipts"
    receipts_dir.mkdir(mode=0o750, parents=True, exist_ok=True)
    set_owner(receipts_dir, 0, app_user.pw_gid)
    op_id = receipt["operation_id"]
    atomic_write_json(receipts_dir / f"{op_id}.json", receipt, mode=0o640, uid=0, gid=app_user.pw_gid)
    atomic_write_json(receipts_dir / "latest-receipt.json", receipt, mode=0o640, uid=0, gid=app_user.pw_gid)


def execute_apply(
    archive_path: Path,
    commit_sha: str | None = None,
    base: Path = BASE_DIR,
    runtime_env_path: Path = RUNTIME_ENV,
) -> dict:
    require_root()

    app_user = get_app_user(base)
    plan_info = execute_plan(archive_path, commit_sha, base=base, runtime_env_path=runtime_env_path)
    target_commit = plan_info["commit"]

    if plan_info.get("status") == "no_op_already_active":
        expected_dir = Path(plan_info["current_target"]).resolve(strict=True)
        runtime_vars = load_runtime_env(runtime_env_path, app_user, check_permissions=(os.geteuid() == 0))
        app_env = build_app_env(runtime_vars, app_user)
        wait_and_verify_release(expected_dir, base, app_user, app_env)
        verify_saved_pm2(app_user, expected_dir)
        receipt = {
            "operation_id": f"op-noop-{int(time.time())}-{uuid.uuid4().hex[:8]}",
            "status": "active_verified",
            "controller_version": CONTROLLER_VERSION,
            "target_commit": target_commit,
            "timestamp_utc": now_iso_utc(),
            "timestamp_wib": now_wib_str(),
            "note": "no_op_already_active",
            "current_target": str(expected_dir),
        }
        write_receipt(base, app_user, receipt)
        return receipt

    runtime_vars = load_runtime_env(runtime_env_path, app_user, check_permissions=(os.geteuid() == 0))
    app_env = build_app_env(runtime_vars, app_user)

    # Step 1: Pre-lock backup
    execute_backup_safely(base)

    # Step 2: Acquire deployment locks
    deploy_lock_file = (base / ".deploy.lock").open("a")
    ops_lock_file = (base / ".ops.lock").open("a")
    try:
        fcntl.flock(deploy_lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        fcntl.flock(ops_lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        deploy_lock_file.close()
        ops_lock_file.close()
        raise RuntimeError("Another deployment or backup is currently in progress (locks held).")

    try:
        # Re-verify backup freshness & integrity after lock acquisition
        backup_meta = verify_backup_record(base)

        releases_dir = base / "releases"
        releases_dir.mkdir(mode=0o750, parents=True, exist_ok=True)
        set_owner(releases_dir, 0, app_user.pw_gid)
        staging_dir = releases_dir / f"staging-{target_commit}-{uuid.uuid4().hex[:8]}"
        staging_dir.mkdir(mode=0o750, parents=True, exist_ok=False)
        set_owner(staging_dir, 0, app_user.pw_gid)

        # Step 3: Extract & verify archive
        manifest = inspect_archive(archive_path)
        with tarfile.open(archive_path, "r:gz") as tar:
            for member in tar.getmembers():
                norm = member.name.replace("\\", "/").lstrip("./")
                if not norm:
                    continue
                dest_path = (staging_dir / norm).resolve()
                if not dest_path.is_relative_to(staging_dir.resolve()):
                    raise ValueError(f"INVALID_ARTIFACT: Member escapes staging directory: {member.name}")
                if member.isdir():
                    dest_path.mkdir(mode=0o750, parents=True, exist_ok=True)
                    set_owner(dest_path, 0, app_user.pw_gid)
                elif member.isreg():
                    dest_path.parent.mkdir(mode=0o750, parents=True, exist_ok=True)
                    set_owner(dest_path.parent, 0, app_user.pw_gid)
                    with dest_path.open("wb") as out_f:
                        src_f = tar.extractfile(member)
                        if src_f:
                            shutil.copyfileobj(src_f, out_f)
                        out_f.flush()
                        os.fsync(out_f.fileno())
                    file_mode = 0o750 if (member.mode & 0o111) else 0o640
                    dest_path.chmod(file_mode)
                    set_owner(dest_path, 0, app_user.pw_gid)
                else:
                    raise ValueError(f"INVALID_ARTIFACT: Unsupported tar member type: {member.name}")

        # Verify all manifest files and checksums
        for rel_file, meta in manifest.get("files", {}).items():
            fpath = staging_dir / rel_file
            if not fpath.is_file() or fpath.is_symlink():
                raise FileNotFoundError(f"INVALID_ARTIFACT: Missing extracted file: {rel_file}")
            f_sha = sha256_file(fpath)
            if f_sha != meta["sha256"]:
                raise ValueError(f"INVALID_ARTIFACT: Checksum mismatch for {rel_file}: expected {meta['sha256']}, got {f_sha}")

        # Link backend/data strictly to persistent shared/data
        backend_data = staging_dir / "backend/data"
        if os.path.lexists(backend_data):
            raise RuntimeError("INVALID_ARTIFACT: Extracted release must not contain backend/data.")
        backend_data.symlink_to(base / "shared/data")

        # Move staging into final release directory
        final_release_dir = releases_dir / f"layanan-pensiunan-{target_commit}-production"
        if final_release_dir.exists():
            tmp_replace = releases_dir / f"replace-{uuid.uuid4().hex[:8]}"
            os.rename(final_release_dir, tmp_replace)
            shutil.rmtree(tmp_replace, ignore_errors=True)

        os.rename(staging_dir, final_release_dir)
        sync_dir(releases_dir)

        # Step 4: Re-verify live process and current alignment right before stop
        pre_stop_status = inspect_status(base)
        if (
            pre_stop_status.get("error_code") == "CURRENT_PID_MISMATCH"
            or pre_stop_status.get("alignment") != "aligned"
            or pre_stop_status.get("current_target") != plan_info.get("previous_release_dir")
        ):
            raise RuntimeError(
                pre_stop_status.get("diagnosis")
                or "CURRENT_PID_MISMATCH [phase=pre_stop]: Live process or current symlink drifted before stop; aborting without stopping active service."
            )

        prev_release_dir = Path(pre_stop_status["current_target"]).resolve(strict=True)

        # Step 5: Stop old process, activate new release, verify HTTP/PID/cwd, switch current, save PM2
        try:
            stop_pm2_release(app_user, app_env)
            start_pm2_release(final_release_dir, base, app_user, runtime_vars, app_env)
            proc_info = wait_and_verify_release(final_release_dir, base, app_user, app_env)
            point_current_symlink(base, final_release_dir)
            save_and_verify_pm2(final_release_dir, base, app_user, app_env)
        except Exception as activation_err:
            # Automatic code rollback (never restore database snapshot!)
            if check_release_compatible(prev_release_dir):
                try:
                    point_current_symlink(base, prev_release_dir)
                    stop_pm2_release(app_user, app_env)
                    start_pm2_release(prev_release_dir, base, app_user, runtime_vars, app_env)
                    restored_proc = wait_and_verify_release(prev_release_dir, base, app_user, app_env)
                    save_and_verify_pm2(prev_release_dir, base, app_user, app_env)
                except Exception as recovery_err:
                    op_id = f"op-manual-recovery-{int(time.time())}-{uuid.uuid4().hex[:8]}"
                    manual_receipt = {
                        "operation_id": op_id,
                        "status": "MANUAL_RECOVERY_REQUIRED",
                        "controller_version": CONTROLLER_VERSION,
                        "failed_target_commit": target_commit,
                        "previous_release": prev_release_dir.name,
                        "timestamp_utc": now_iso_utc(),
                        "timestamp_wib": now_wib_str(),
                        "activation_error": str(activation_err),
                        "recovery_error": str(recovery_err),
                        "database_preserved": True,
                    }
                    write_receipt(base, app_user, manual_receipt)
                    raise RuntimeError(
                        f"MANUAL_RECOVERY_REQUIRED: Release activation failed ({activation_err}) "
                        f"and rollback verification failed ({recovery_err}). Database preserved."
                    ) from recovery_err

                op_id = f"op-rollback-{int(time.time())}-{uuid.uuid4().hex[:8]}"
                rollback_receipt = {
                    "operation_id": op_id,
                    "status": "failed_code_restored",
                    "controller_version": CONTROLLER_VERSION,
                    "failed_target_commit": target_commit,
                    "restored_release": prev_release_dir.name,
                    "current_target": str(prev_release_dir),
                    "restored_pid": restored_proc.get("pid"),
                    "pm2_saved": True,
                    "database_preserved": True,
                    "timestamp_utc": now_iso_utc(),
                    "timestamp_wib": now_wib_str(),
                    "error": str(activation_err),
                }
                write_receipt(base, app_user, rollback_receipt)
                raise RuntimeError(
                    f"STARTUP_FAILED: {activation_err}. Restored previous release {prev_release_dir.name} (failed_code_restored)."
                ) from activation_err
            else:
                op_id = f"op-manual-recovery-{int(time.time())}-{uuid.uuid4().hex[:8]}"
                manual_receipt = {
                    "operation_id": op_id,
                    "status": "MANUAL_RECOVERY_REQUIRED",
                    "controller_version": CONTROLLER_VERSION,
                    "failed_target_commit": target_commit,
                    "timestamp_utc": now_iso_utc(),
                    "timestamp_wib": now_wib_str(),
                    "activation_error": str(activation_err),
                    "recovery_error": "Previous release incompatible or unavailable for automatic rollback.",
                    "database_preserved": True,
                }
                write_receipt(base, app_user, manual_receipt)
                raise RuntimeError(
                    f"MANUAL_RECOVERY_REQUIRED: {activation_err}. No compatible previous release to restore."
                ) from activation_err

        # Step 6: Generate & save verified receipt
        op_id = f"op-deploy-{int(time.time())}-{uuid.uuid4().hex[:8]}"
        receipt = {
            "operation_id": op_id,
            "status": "active_verified",
            "controller_version": CONTROLLER_VERSION,
            "target_commit": target_commit,
            "previous_commit": plan_info.get("previous_commit"),
            "previous_release": prev_release_dir.name,
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
        write_receipt(base, app_user, receipt)
        return receipt

    finally:
        deploy_lock_file.close()
        ops_lock_file.close()


def main():
    parser = argparse.ArgumentParser(description="Layanan Pensiunan Server Release Controller")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("status", help="Inspect live deployment status and alignment")

    plan_parser = subparsers.add_parser("plan", help="Validate archive and prerequisites without changes")
    plan_parser.add_argument("--archive", required=True, help="Path to release .tar.gz archive")
    plan_parser.add_argument("--commit", help="Expected full 40-character commit SHA")

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
