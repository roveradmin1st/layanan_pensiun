from datetime import datetime, timezone
import http.client
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import sqlite3
import subprocess
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest import mock

from ops import package_release
from ops import server_release
from test_production import fixture


class FakeServerEnvironment:
    """
    Controlled service boundary for PM2, loopback listener checks, and root chown
    on non-root test runners, while keeping all archive extraction, checksum
    verification, symlink switches, runtime.env parsing, and SQLite checks real.
    """

    def __init__(self, root: Path, fail_mode: str | None = None):
        self.root = root
        self.fail_mode = fail_mode
        self.base = root / "srv"
        self.releases = self.base / "releases"
        self.shared = self.base / "shared/data"
        self.backups = self.base / "backups"
        self.service_home = self.base / "service-home"
        self.pm2_dir = self.service_home / ".pm2"

        for d in (self.releases, self.shared, self.backups, self.pm2_dir):
            d.mkdir(parents=True, exist_ok=True)

        # Persistent live SQLite database with sentinel payload
        self.live_db = self.shared / "enterprise.sqlite"
        fixture(self.live_db)
        with sqlite3.connect(self.live_db) as db:
            db.execute("CREATE TABLE IF NOT EXISTS sentinel (note TEXT)")
            db.execute("INSERT INTO sentinel (note) VALUES ('PERSISTENT_LIVE_DATA_20261109')")
            db.commit()
        self.live_db_sha256 = server_release.sha256_file(self.live_db)

        # Validated runtime.env
        self.jwt_secret = "prod_jwt_secret_" + ("9" * 48)
        self.runtime_env = root / "runtime.env"
        self.runtime_env.write_text(
            f"NODE_ENV=production\nHOST=127.0.0.1\nPORT=4000\nJWT_SECRET='{self.jwt_secret}'\n",
            encoding="utf-8",
        )
        self.runtime_env.chmod(0o640)

        # Verified recent backup
        self.backup_file = self.backups / "backup-20261109.sqlite"
        shutil.copyfile(self.live_db, self.backup_file)
        self.backup_meta = {
            "status": "backup_verified",
            "integrity": "ok",
            "backup": str(self.backup_file),
            "sha256": server_release.sha256_file(self.backup_file),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        (self.backups / "latest-verified.json").write_text(
            json.dumps(self.backup_meta, indent=2) + "\n",
            encoding="utf-8",
        )

        # Existing active release (c76e823...)
        self.old_commit = "c76e823db5a047807bea77ad6c03f2985e62560b"
        self.rel_old = self.releases / f"layanan-pensiunan-{self.old_commit}-production"
        (self.rel_old / "backend/src").mkdir(parents=True)
        (self.rel_old / "backend/src/server.js").write_text("console.log('old release c76e823');\n")
        (self.rel_old / "backend/package.json").write_text('{"name":"backend","version":"1.0.0"}\n')
        (self.rel_old / "backend/package-lock.json").write_text('{"lockfileVersion":3}\n')
        (self.rel_old / "backend/ecosystem.config.cjs").write_text("module.exports = {};\n")
        (self.rel_old / "frontend/dist").mkdir(parents=True)
        (self.rel_old / "frontend/dist/index.html").write_text("<!doctype html><title>Old c76e823</title>\n")
        (self.rel_old / ".node-version").write_text("24.22.2\n")
        (self.rel_old / "release-manifest.json").write_text(
            json.dumps({
                "commit": self.old_commit,
                "data_contract": "lp-production-20261109-v1",
                "target_os": "ubuntu-24.04",
                "node_version": "24.22.2",
                "files": {},
            }),
            encoding="utf-8",
        )
        (self.rel_old / "backend/data").symlink_to(self.shared)
        (self.base / "current").symlink_to(self.rel_old)

        self.app_user = SimpleNamespace(
            pw_name="lpapp",
            pw_uid=os.getuid(),
            pw_gid=os.getgid(),
            pw_dir=str(self.service_home),
        )

        self.pm2_running = {
            "pid": 4100,
            "status": "online",
            "cwd": str((self.rel_old / "backend").resolve()),
            "script": str((self.rel_old / "backend/src/server.js").resolve()),
            "exec_mode": "fork_mode",
            "instances": 1,
            "env": {
                "NODE_ENV": "production",
                "HOST": "127.0.0.1",
                "PORT": "4000",
                "JWT_SECRET": self.jwt_secret,
            },
        }
        self.started_configs: list[dict] = []
        self.pm2_commands: list[list[str]] = []
        self._write_dump()

    def _pm2_entry(self) -> dict:
        return {
            "name": "layanan-pensiunan-api",
            "pid": self.pm2_running["pid"],
            "exec_mode": self.pm2_running["exec_mode"],
            "instances": self.pm2_running["instances"],
            "status": self.pm2_running["status"],
            "pm_cwd": self.pm2_running["cwd"],
            "pm_exec_path": self.pm2_running["script"],
            "pm2_env": {
                "status": self.pm2_running["status"],
                "pm_cwd": self.pm2_running["cwd"],
                "pm_exec_path": self.pm2_running["script"],
                "instances": self.pm2_running["instances"],
                "exec_mode": self.pm2_running["exec_mode"],
                "restart_time": 0,
                "pm_uptime": 1000,
                "env": self.pm2_running["env"],
            },
        }

    def _write_dump(self) -> None:
        entries = [self._pm2_entry()] if self.pm2_running else []
        (self.pm2_dir / "dump.pm2").write_text(json.dumps(entries, indent=2) + "\n", encoding="utf-8")

    def fake_run_as_app(self, args, app_user, app_env=None, *, timeout=30, check=True):
        cmd = [str(a) for a in args]
        self.pm2_commands.append(cmd)
        action = cmd[1] if len(cmd) > 1 else ""

        if action == "jlist":
            payload = [self._pm2_entry()] if self.pm2_running else []
            return subprocess.CompletedProcess(cmd, 0, stdout=json.dumps(payload), stderr="")

        if action == "delete":
            if self.fail_mode == "stop_failed":
                if check:
                    raise RuntimeError("App command pm2 failed with exit code 1.")
                return subprocess.CompletedProcess(cmd, 1, stdout="", stderr="delete error")
            self.pm2_running = None
            return subprocess.CompletedProcess(cmd, 0, stdout="[]", stderr="")

        if action == "start":
            config_file = Path(cmd[2])
            if not config_file.is_file():
                raise AssertionError(f"PM2 start config file missing: {config_file}")
            raw_cfg = json.loads(config_file.read_text(encoding="utf-8"))
            app_cfg = raw_cfg["apps"][0]
            self.started_configs.append(app_cfg)

            target_cwd = Path(app_cfg["cwd"]).resolve()
            is_new = target_cwd.parent != self.rel_old.resolve()

            if is_new and self.fail_mode == "start_cmd_failed":
                if check:
                    raise RuntimeError("App command pm2 failed with exit code 1.")
                return subprocess.CompletedProcess(cmd, 1, stdout="", stderr="start error")

            if not is_new and self.fail_mode == "rollback_start_failed":
                if check:
                    raise RuntimeError("App command pm2 failed with exit code 1.")
                return subprocess.CompletedProcess(cmd, 1, stdout="", stderr="rollback start error")

            self.pm2_running = {
                "pid": 5200 if is_new else 4101,
                "status": "online",
                "cwd": str(target_cwd),
                "script": str(Path(app_cfg["script"]).resolve()),
                "exec_mode": "fork_mode",
                "instances": app_cfg.get("instances", 1),
                "env": app_cfg.get("env", {}),
            }
            return subprocess.CompletedProcess(cmd, 0, stdout="[]", stderr="")

        if action == "save":
            is_new = (
                self.pm2_running is not None
                and Path(self.pm2_running["cwd"]).parent != self.rel_old.resolve()
            )
            if is_new and self.fail_mode == "pm2_save_failed":
                if check:
                    raise RuntimeError("App command pm2 failed with exit code 1.")
                return subprocess.CompletedProcess(cmd, 1, stdout="", stderr="save error")
            if is_new and self.fail_mode == "pm2_dump_corrupt":
                (self.pm2_dir / "dump.pm2").write_text("[]\n", encoding="utf-8")
                return subprocess.CompletedProcess(cmd, 0, stdout="", stderr="")
            self._write_dump()
            return subprocess.CompletedProcess(cmd, 0, stdout="", stderr="")

        raise AssertionError(f"Unexpected run_as_app command: {cmd}")

    def fake_listeners(self, port: int) -> list[str]:
        if self.pm2_running and self.pm2_running.get("status") == "online":
            return [f"127.0.0.1:{port}"]
        return []

    def fake_http(self, port: int, route: str, method: str = "GET", body: bytes | None = None) -> tuple[int, bytes]:
        if not self.pm2_running or self.pm2_running.get("status") != "online":
            raise ConnectionRefusedError("Backend not running")
        active_rel = Path(self.pm2_running["cwd"]).parent
        is_new = active_rel != self.rel_old.resolve()

        if is_new and self.fail_mode == "poll_timeout":
            raise ConnectionRefusedError("Simulated startup timeout")
        if route == "/api/auth/me":
            return 401, b'{"detail":"Unauthorized"}'
        if route == "/":
            if is_new and self.fail_mode == "bad_html":
                return 200, b"<html>STALE OR CORRUPT HTML</html>"
            return 200, (active_rel / "frontend/dist/index.html").read_bytes()
        if route == "/api/users":
            if is_new and self.fail_mode == "anon_api_not_401":
                return 200, b"[]"
            return 401, b'{"detail":"Unauthorized"}'
        if route == "/api/auth/quick-role":
            if is_new and self.fail_mode == "quick_role_not_403":
                return 200, b"{}"
            return 403, b'{"detail":"Forbidden"}'
        return 404, b"{}"


class DeploymentAutomationTests(unittest.TestCase):
    def setUp(self):
        self._active_patches = []
        self.addCleanup(self._stop_active_patches)
        self.temp_dir = tempfile.TemporaryDirectory(prefix="lp-deploy-test-")
        self.root = Path(self.temp_dir.name)
        self.addCleanup(self.temp_dir.cleanup)

        # Build mock repo structure for packaging tests
        self.repo = self.root / "repo"
        self.repo.mkdir()
        (self.repo / ".node-version").write_text("24.22.2\n")

        # Backend
        (self.repo / "backend/src").mkdir(parents=True)
        (self.repo / "backend/src/server.js").write_text("console.log('test server');\n")
        (self.repo / "backend/package.json").write_text('{"name":"test-backend","version":"1.0.0"}\n')
        (self.repo / "backend/package-lock.json").write_text('{"lockfileVersion":3}\n')
        (self.repo / "backend/node_modules/express").mkdir(parents=True)
        (self.repo / "backend/node_modules/express/index.js").write_text("module.exports = {};\n")

        # Frontend dist
        (self.repo / "frontend/dist/assets").mkdir(parents=True)
        (self.repo / "frontend/dist/index.html").write_text("<!doctype html><html><body>New Release UI</body></html>\n")
        (self.repo / "frontend/dist/assets/app.js").write_text("console.log('client');\n")

        # Ecosystem
        (self.repo / "ops").mkdir(parents=True)
        (self.repo / "ops/ecosystem.config.cjs").write_text("module.exports = { apps: [] };\n")

        # Plant forbidden files to test denylist
        (self.repo / ".git").mkdir()
        (self.repo / ".git/config").write_text("[core]\n")
        (self.repo / ".env").write_text("SECRET=leaked\n")
        (self.repo / ".env.local").write_text("SECRET2=leaked\n")
        (self.repo / "backend/data").mkdir()
        (self.repo / "backend/data/enterprise.sqlite").write_text("LEAKED_DB_SENTINEL")
        (self.repo / "credentials.private.json").write_text('{"password":"secret"}\n')
        (self.repo / "cert.key").write_text("PRIVATE_KEY\n")
        (self.repo / "backend/tests").mkdir()
        (self.repo / "backend/tests/unit.test.mjs").write_text("// test code\n")
        (self.repo / "ops/privileged_tool.py").write_text("# privileged script\n")

        self.commit = "a" * 40

    def _stop_active_patches(self):
        for p in reversed(self._active_patches):
            try:
                p.stop()
            except Exception:
                pass
        self._active_patches.clear()

    def _patch_env(self, env: FakeServerEnvironment, node_version: str = "24.22.2"):
        self._stop_active_patches()
        patches = [
            mock.patch.object(server_release, "require_root", return_value=None),
            mock.patch.object(
                server_release,
                "set_owner",
                side_effect=lambda p, u, g: os.fchown(p, os.getuid(), os.getgid())
                if isinstance(p, int)
                else os.chown(p, os.getuid(), os.getgid()),
            ),
            mock.patch.object(server_release, "get_app_user", return_value=env.app_user),
            mock.patch.object(server_release, "get_pm2_binary", return_value="/usr/bin/pm2"),
            mock.patch.object(server_release, "get_system_node_version", return_value=node_version),
            mock.patch.object(server_release, "run_as_app", side_effect=env.fake_run_as_app),
            mock.patch.object(server_release, "get_listening_addresses", side_effect=env.fake_listeners),
            mock.patch.object(server_release, "http_request", side_effect=env.fake_http),
            mock.patch("shutil.disk_usage", return_value=SimpleNamespace(free=10 * 1024**3)),
            mock.patch("time.sleep", return_value=None),
        ]
        for p in patches:
            p.start()
            self._active_patches.append(p)

    def test_package_allowlist_and_denylist_enforcement(self):
        output_tar = self.root / "test-release.tar.gz"
        manifest = package_release.create_release_package(
            commit=self.commit,
            output_path=output_tar,
            root=self.repo,
            created_at="2026-11-09T00:00:00Z",
        )

        self.assertEqual(manifest["commit"], self.commit)
        self.assertEqual(manifest["data_contract"], "lp-production-20261109-v1")
        self.assertEqual(manifest["node_version"], "24.22.2")
        self.assertTrue(output_tar.is_file())

        files = manifest["files"]
        self.assertIn(".node-version", files)
        self.assertIn("backend/package.json", files)
        self.assertIn("backend/src/server.js", files)
        self.assertIn("backend/node_modules/express/index.js", files)
        self.assertIn("frontend/dist/index.html", files)
        self.assertIn("frontend/dist/assets/app.js", files)
        self.assertIn("backend/ecosystem.config.cjs", files)

        for path_str in files.keys():
            self.assertFalse(path_str.startswith(".git"))
            self.assertFalse(".env" in path_str)
            self.assertFalse(".sqlite" in path_str)
            self.assertFalse("backend/data" in path_str)
            self.assertFalse(".private.json" in path_str)
            self.assertFalse(".key" in path_str)
            self.assertFalse("tests/" in path_str)
            self.assertFalse("ops/" in path_str)

    def test_package_fails_if_frontend_dist_missing(self):
        shutil.rmtree(self.repo / "frontend/dist")
        output_tar = self.root / "fail.tar.gz"
        with self.assertRaises(FileNotFoundError):
            package_release.create_release_package(commit=self.commit, output_path=output_tar, root=self.repo)

    def test_runtime_env_parser_validates_and_never_expands_or_leaks_secrets(self):
        secret = "$(never_expand_command)_" + ("x" * 40)
        valid_text = f"NODE_ENV=production\nHOST=127.0.0.1\nPORT=4000\nJWT_SECRET='{secret}'\n"
        parsed = server_release.parse_runtime_env(valid_text)
        self.assertEqual(parsed["JWT_SECRET"], secret)
        self.assertEqual(parsed["NODE_ENV"], "production")
        self.assertEqual(parsed["HOST"], "127.0.0.1")
        self.assertEqual(parsed["PORT"], "4000")

        for invalid_line in (
            "PORT=5000\n",
            "NODE_OPTIONS=--inspect\n",
            "LD_PRELOAD=/tmp/evil.so\n",
        ):
            with self.assertRaises(RuntimeError) as ctx:
                server_release.parse_runtime_env(valid_text + invalid_line)
            self.assertNotIn(secret, str(ctx.exception))

    def test_current_pid_mismatch_incident_rejected_in_status_plan_and_apply(self):
        # Regression: current points to 2c20fd2 while port 4000 process still runs from c76e823/backend
        env = FakeServerEnvironment(self.root / "mismatch-case")
        self._patch_env(env)

        commit_2c2 = "2c20fd20c9272968c5da64f5dfb42e05ffad4e36"
        rel_2c2 = env.releases / f"layanan-pensiunan-{commit_2c2}-production"
        shutil.copytree(env.rel_old, rel_2c2, symlinks=True)
        (rel_2c2 / "release-manifest.json").write_text(
            json.dumps({
                "commit": commit_2c2,
                "data_contract": "lp-production-20261109-v1",
                "target_os": "ubuntu-24.04",
                "node_version": "24.22.2",
                "files": {},
            })
        )
        # Point current to 2c20fd2 while PM2 process continues running from rel_old (c76e823)
        server_release.point_current_symlink(env.base, rel_2c2)

        status = server_release.inspect_status(env.base)
        self.assertEqual(status["status"], "CURRENT_PID_MISMATCH")
        self.assertEqual(status["alignment"], "mismatch")
        self.assertIn("2c20fd2", status["diagnosis"])
        self.assertIn("c76e823", status["diagnosis"])

        output_tar = self.root / "new-release.tar.gz"
        package_release.create_release_package(commit=self.commit, output_path=output_tar, root=self.repo)

        with self.assertRaisesRegex(RuntimeError, "CURRENT_PID_MISMATCH"):
            server_release.execute_plan(output_tar, self.commit, base=env.base, runtime_env_path=env.runtime_env)

        with self.assertRaisesRegex(RuntimeError, "CURRENT_PID_MISMATCH"):
            server_release.execute_apply(output_tar, self.commit, base=env.base, runtime_env_path=env.runtime_env)

        # Running process c76e823 must NOT have been stopped or restarted
        self.assertEqual(env.pm2_running["pid"], 4100)
        self.assertEqual(Path(env.pm2_running["cwd"]), (env.rel_old / "backend").resolve())
        self.assertEqual(env.started_configs, [])

    def test_plan_and_apply_reject_node_version_mismatch(self):
        env = FakeServerEnvironment(self.root / "node-mismatch")
        self._patch_env(env, node_version="24.22.1")

        output_tar = self.root / "test-release.tar.gz"
        package_release.create_release_package(commit=self.commit, output_path=output_tar, root=self.repo)

        with self.assertRaisesRegex(ValueError, "RUNTIME_MISMATCH: Node version mismatch: system 24.22.1 vs package 24.22.2"):
            server_release.execute_plan(output_tar, self.commit, base=env.base, runtime_env_path=env.runtime_env)

    def test_plan_and_apply_report_no_op_when_already_active_and_aligned(self):
        env = FakeServerEnvironment(self.root / "noop-case")
        self._patch_env(env)

        output_tar = self.root / "old-release.tar.gz"
        package_release.create_release_package(commit=env.old_commit, output_path=output_tar, root=self.repo)

        plan = server_release.execute_plan(output_tar, env.old_commit, base=env.base, runtime_env_path=env.runtime_env)
        self.assertEqual(plan["status"], "no_op_already_active")

        receipt = server_release.execute_apply(output_tar, env.old_commit, base=env.base, runtime_env_path=env.runtime_env)
        self.assertEqual(receipt["status"], "active_verified")
        self.assertEqual(receipt["note"], "no_op_already_active")
        self.assertEqual(env.started_configs, [])

    def test_apply_safely_preserves_persistent_database_and_loads_runtime_env(self):
        env = FakeServerEnvironment(self.root / "apply-success")
        self._patch_env(env)

        output_tar = self.root / "test-release.tar.gz"
        package_release.create_release_package(commit=self.commit, output_path=output_tar, root=self.repo)

        receipt = server_release.execute_apply(
            output_tar,
            self.commit,
            base=env.base,
            runtime_env_path=env.runtime_env,
        )

        self.assertEqual(receipt["status"], "active_verified")
        self.assertEqual(receipt["target_commit"], self.commit)
        self.assertEqual(receipt["previous_commit"], env.old_commit)
        self.assertTrue(receipt["checks"]["frontend_200"])
        self.assertTrue(receipt["checks"]["api_anonymous_401"])
        self.assertTrue(receipt["checks"]["quick_role_403"])
        self.assertTrue(receipt["checks"]["pm2_saved"])

        # Verify runtime.env was loaded and passed to PM2 start config
        self.assertEqual(len(env.started_configs), 1)
        started_cfg = env.started_configs[0]
        self.assertEqual(started_cfg["name"], "layanan-pensiunan-api")
        self.assertEqual(started_cfg["exec_mode"], "fork")
        self.assertEqual(started_cfg["instances"], 1)
        self.assertEqual(started_cfg["env"]["NODE_ENV"], "production")
        self.assertEqual(started_cfg["env"]["HOST"], "127.0.0.1")
        self.assertEqual(started_cfg["env"]["PORT"], "4000")
        self.assertEqual(started_cfg["env"]["JWT_SECRET"], env.jwt_secret)

        # Verify persistent database was NEVER overwritten or modified
        self.assertEqual(server_release.sha256_file(env.live_db), env.live_db_sha256)
        with sqlite3.connect(env.live_db) as db:
            row = db.execute("SELECT note FROM sentinel").fetchone()
            self.assertEqual(row, ("PERSISTENT_LIVE_DATA_20261109",))

        # Verify current symlink, PM2 cwd, and dump.pm2 all point to the new release
        new_rel = env.releases / f"layanan-pensiunan-{self.commit}-production"
        self.assertEqual((env.base / "current").resolve(), new_rel.resolve())
        self.assertEqual(Path(env.pm2_running["cwd"]).resolve(), (new_rel / "backend").resolve())
        self.assertEqual((new_rel / "backend/data").resolve(), env.shared.resolve())
        server_release.verify_saved_pm2(env.app_user, new_rel)

    def test_apply_rolls_back_and_verifies_old_release_across_all_failure_modes(self):
        failure_modes = (
            "start_cmd_failed",
            "poll_timeout",
            "bad_html",
            "anon_api_not_401",
            "quick_role_not_403",
            "pm2_save_failed",
            "pm2_dump_corrupt",
        )
        output_tar = self.root / "test-release.tar.gz"
        package_release.create_release_package(commit=self.commit, output_path=output_tar, root=self.repo)

        for mode in failure_modes:
            with self.subTest(mode=mode):
                env = FakeServerEnvironment(self.root / f"fail-{mode}", fail_mode=mode)
                self._patch_env(env)

                with self.assertRaisesRegex(RuntimeError, "failed_code_restored"):
                    server_release.execute_apply(
                        output_tar,
                        self.commit,
                        base=env.base,
                        runtime_env_path=env.runtime_env,
                    )

                # Verify old release is restored, aligned, and saved in dump.pm2
                self.assertEqual((env.base / "current").resolve(), env.rel_old.resolve())
                self.assertIsNotNone(env.pm2_running)
                self.assertEqual(Path(env.pm2_running["cwd"]).resolve(), (env.rel_old / "backend").resolve())
                self.assertEqual(env.pm2_running["env"]["JWT_SECRET"], env.jwt_secret)
                server_release.verify_saved_pm2(env.app_user, env.rel_old)

                # Verify latest-receipt.json records failed_code_restored
                latest = json.loads((env.releases / "receipts/latest-receipt.json").read_text(encoding="utf-8"))
                self.assertEqual(latest["status"], "failed_code_restored")
                self.assertEqual(latest["restored_release"], env.rel_old.name)

                # Verify live database is untouched
                self.assertEqual(server_release.sha256_file(env.live_db), env.live_db_sha256)

    def test_apply_records_manual_recovery_required_when_rollback_also_fails(self):
        output_tar = self.root / "test-release.tar.gz"
        package_release.create_release_package(commit=self.commit, output_path=output_tar, root=self.repo)

        env = FakeServerEnvironment(self.root / "fail-both", fail_mode="rollback_start_failed")
        self._patch_env(env)

        # Make new release fail readiness, and rollback fail start
        orig_http = env.fake_http

        def fail_new_http(port, route, method="GET", body=None):
            if env.pm2_running and Path(env.pm2_running["cwd"]).parent != env.rel_old.resolve():
                raise ConnectionRefusedError("New release failed")
            return orig_http(port, route, method, body)

        with mock.patch.object(server_release, "http_request", side_effect=fail_new_http):
            with self.assertRaisesRegex(RuntimeError, "MANUAL_RECOVERY_REQUIRED"):
                server_release.execute_apply(
                    output_tar,
                    self.commit,
                    base=env.base,
                    runtime_env_path=env.runtime_env,
                )

        latest = json.loads((env.releases / "receipts/latest-receipt.json").read_text(encoding="utf-8"))
        self.assertEqual(latest["status"], "MANUAL_RECOVERY_REQUIRED")
        self.assertTrue(latest["database_preserved"])
        self.assertEqual(server_release.sha256_file(env.live_db), env.live_db_sha256)

    def test_extracted_package_runs_two_real_production_cold_starts_with_node(self):
        real_repo_root = Path(__file__).resolve().parents[2]
        node_bin = shutil.which("node")
        self.assertIsNotNone(node_bin, "Node binary required for real package execution test")

        # Assemble a realistic build tree with real backend/src and backend/node_modules
        pkg_source = self.root / "real-pkg-source"
        pkg_source.mkdir()
        sys_node_ver = server_release.get_system_node_version(node_bin)
        (pkg_source / ".node-version").write_text(sys_node_ver + "\n", encoding="utf-8")
        for folder in ("src", "node_modules"):
            shutil.copytree(real_repo_root / "backend" / folder, pkg_source / "backend" / folder, symlinks=True)
        for name in ("package.json", "package-lock.json"):
            shutil.copyfile(real_repo_root / "backend" / name, pkg_source / "backend" / name)
        (pkg_source / "ops").mkdir()
        shutil.copyfile(real_repo_root / "ops/ecosystem.config.cjs", pkg_source / "ops/ecosystem.config.cjs")
        (pkg_source / "frontend/dist").mkdir(parents=True)
        expected_html = b"<!doctype html><html><body>Real Packaged Production Smoke</body></html>\n"
        (pkg_source / "frontend/dist/index.html").write_bytes(expected_html)

        archive_path = self.root / "real-runtime.tar.gz"
        package_release.create_release_package(commit=self.commit, output_path=archive_path, root=pkg_source)

        # Extract archive using inspect_archive + tarfile
        manifest = server_release.inspect_archive(archive_path)
        extracted_dir = self.root / "extracted-release"
        extracted_dir.mkdir()
        with package_release.tarfile.open(archive_path, "r:gz") as tar:
            tar.extractall(extracted_dir, filter="data")

        for rel_file, meta in manifest["files"].items():
            self.assertEqual(server_release.sha256_file(extracted_dir / rel_file), meta["sha256"])

        # Prepare synthetic production database
        shared_data = self.root / "shared-data"
        shared_data.mkdir()
        db_file = shared_data / "enterprise.sqlite"
        fixture(db_file)
        (extracted_dir / "backend/data").symlink_to(shared_data, target_is_directory=True)

        # Run 2 cold starts in production mode with real Node
        for attempt in range(2):
            with socket.socket() as sock:
                sock.bind(("127.0.0.1", 0))
                port = sock.getsockname()[1]

            env = {
                "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
                "HOME": str(self.root),
                "TZ": "Asia/Jakarta",
                "NODE_ENV": "production",
                "HOST": "127.0.0.1",
                "PORT": str(port),
                "JWT_SECRET": secrets.token_hex(32),
            }
            proc = subprocess.Popen(
                [node_bin, "src/server.js"],
                cwd=extracted_dir / "backend",
                env=env,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
            )
            try:
                ready = False
                for _ in range(60):
                    self.assertIsNone(proc.poll(), f"Real packaged server exited early on start #{attempt + 1}")
                    try:
                        status, _ = server_release.http_request(port, "/api/auth/me")
                        if status == 401:
                            ready = True
                            break
                    except (OSError, http.client.HTTPException):
                        pass
                    time.sleep(0.2)
                self.assertTrue(ready, f"Real packaged server did not become ready on start #{attempt + 1}")

                st_root, body_root = server_release.http_request(port, "/")
                self.assertEqual(st_root, 200)
                self.assertEqual(body_root, expected_html)

                st_users, _ = server_release.http_request(port, "/api/users")
                self.assertEqual(st_users, 401)

                st_qr, _ = server_release.http_request(port, "/api/auth/quick-role", method="POST", body=b"{}")
                self.assertEqual(st_qr, 403)
            finally:
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    proc.wait()

        self.assertTrue(server_release.check_sqlite_quick(db_file))


if __name__ == "__main__":
    unittest.main()
