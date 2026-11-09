import json
import os
from pathlib import Path
import shutil
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock

from ops import package_release
from ops import server_release


class DeploymentAutomationTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(prefix="lp-deploy-test-")
        self.root = Path(self.temp_dir.name)
        self.addCleanup(self.temp_dir.cleanup)

        # Build mock repo structure
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
        (self.repo / "frontend/dist/index.html").write_text("<!doctype html><html><body>Test UI</body></html>\n")
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
        # Required files must be in package
        self.assertIn(".node-version", files)
        self.assertIn("backend/package.json", files)
        self.assertIn("backend/src/server.js", files)
        self.assertIn("backend/node_modules/express/index.js", files)
        self.assertIn("frontend/dist/index.html", files)
        self.assertIn("frontend/dist/assets/app.js", files)
        self.assertIn("backend/ecosystem.config.cjs", files)

        # Denylisted items must NEVER be in package
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

    def test_inspect_status_aligned_and_pid_mismatch(self):
        base = self.root / "srv"
        releases = base / "releases"
        rel_a = releases / "layanan-pensiunan-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-production"
        rel_b = releases / "layanan-pensiunan-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb-production"
        rel_a.mkdir(parents=True)
        rel_b.mkdir(parents=True)

        (rel_a / "release-manifest.json").write_text(json.dumps({"commit": "a" * 40}))
        (rel_b / "release-manifest.json").write_text(json.dumps({"commit": "b" * 40}))

        shared = base / "shared/data"
        shared.mkdir(parents=True)
        # Create minimal sqlite db
        import sqlite3
        with sqlite3.connect(shared / "enterprise.sqlite") as db:
            db.execute("CREATE TABLE kv (k TEXT, v TEXT)")
            db.commit()

        current = base / "current"
        current.symlink_to(rel_a)

        # Case 1: Aligned
        mock_proc_aligned = {
            "pid": 1234,
            "status": "online",
            "cwd": str(rel_a / "backend"),
        }
        with mock.patch("ops.server_release.get_pm2_process_info", return_value=mock_proc_aligned), \
             mock.patch("ops.server_release.get_listening_addresses", return_value=["127.0.0.1:4000"]):
            status = server_release.inspect_status(base)
            self.assertEqual(status["status"], "active_verified")
            self.assertEqual(status["alignment"], "aligned")
            self.assertEqual(status["active_commit"], "a" * 40)

        # Case 2: Mismatch (Incident: current points to A, but process running from B)
        mock_proc_mismatch = {
            "pid": 1234,
            "status": "online",
            "cwd": str(rel_b / "backend"),
        }
        with mock.patch("ops.server_release.get_pm2_process_info", return_value=mock_proc_mismatch), \
             mock.patch("ops.server_release.get_listening_addresses", return_value=["127.0.0.1:4000"]):
            status = server_release.inspect_status(base)
            self.assertEqual(status["status"], "CURRENT_PID_MISMATCH")
            self.assertEqual(status["alignment"], "mismatch")

    def test_plan_reports_no_op_when_already_active(self):
        output_tar = self.root / "test-release.tar.gz"
        package_release.create_release_package(commit=self.commit, output_path=output_tar, root=self.repo)

        base = self.root / "srv"
        rel_a = base / "releases" / f"layanan-pensiunan-{self.commit}-production"
        rel_a.mkdir(parents=True)
        (rel_a / "release-manifest.json").write_text(json.dumps({"commit": self.commit}))

        shared = base / "shared/data"
        shared.mkdir(parents=True)
        import sqlite3
        with sqlite3.connect(shared / "enterprise.sqlite") as db:
            db.execute("CREATE TABLE kv (k TEXT, v TEXT)")
            db.commit()

        (base / "current").symlink_to(rel_a)

        mock_proc = {
            "pid": 5555,
            "status": "online",
            "cwd": str(rel_a / "backend"),
        }
        with mock.patch("ops.server_release.get_pm2_process_info", return_value=mock_proc), \
             mock.patch("ops.server_release.get_listening_addresses", return_value=["127.0.0.1:4000"]), \
             mock.patch("shutil.disk_usage", return_value=SimpleNamespace(free=10 * 1024**3)):
            plan = server_release.execute_plan(output_tar, self.commit, base=base)
            self.assertEqual(plan["status"], "no_op_already_active")

    def test_apply_safely_preserves_persistent_database(self):
        output_tar = self.root / "test-release.tar.gz"
        package_release.create_release_package(commit=self.commit, output_path=output_tar, root=self.repo)

        base = self.root / "srv"
        base.mkdir(parents=True)
        shared = base / "shared/data"
        shared.mkdir(parents=True)
        live_db = shared / "enterprise.sqlite"
        live_db.write_bytes(b"PERSISTENT_DATA_SENTINEL_20261109")

        # Mock backup verification
        mock_backup = {
            "status": "backup_verified",
            "integrity": "ok",
            "backup": str(base / "backups/test.sqlite"),
            "created_at": "2026-11-09T00:00:00Z",
        }

        mock_user = SimpleNamespace(pw_name="lpapp", pw_uid=os.geteuid(), pw_gid=os.getegid())

        with mock.patch("os.geteuid", return_value=0), \
             mock.patch("ops.server_release.get_app_user", return_value=mock_user), \
             mock.patch("ops.server_release.execute_backup_safely", return_value=mock_backup), \
             mock.patch("ops.server_release.get_pm2_process_info", return_value={"pid": 9999, "status": "online", "cwd": str(base / "current/backend")}), \
             mock.patch("ops.server_release.http_request") as mock_http, \
             mock.patch("subprocess.run", return_value=SimpleNamespace(returncode=0, stdout="", stderr="")), \
             mock.patch("shutil.disk_usage", return_value=SimpleNamespace(free=10 * 1024**3)):

            def fake_http(port, route, method="GET", body=None):
                if route == "/":
                    return 200, (self.repo / "frontend/dist/index.html").read_bytes()
                elif route == "/api/auth/me":
                    return 401, b'{"detail":"Unauthorized"}'
                elif route == "/api/users":
                    return 401, b'{"detail":"Unauthorized"}'
                elif route == "/api/auth/quick-role":
                    return 403, b'{"detail":"Forbidden"}'
                return 404, b"{}"

            mock_http.side_effect = fake_http

            receipt = server_release.execute_apply(output_tar, self.commit, base=base)

            self.assertEqual(receipt["status"], "active_verified")
            self.assertEqual(receipt["target_commit"], self.commit)
            self.assertTrue(receipt["checks"]["frontend_200"])
            self.assertTrue(receipt["checks"]["api_anonymous_401"])
            self.assertTrue(receipt["checks"]["quick_role_403"])

            # Verify persistent live database was NEVER overwritten
            self.assertEqual(live_db.read_bytes(), b"PERSISTENT_DATA_SENTINEL_20261109")

            # Verify current symlink points to newly activated release
            current = base / "current"
            self.assertTrue(current.is_symlink())
            self.assertIn(self.commit, str(current.resolve()))

            # Verify backend/data inside release is a symlink to shared/data
            rel_data = current.resolve() / "backend/data"
            self.assertTrue(rel_data.is_symlink())
            self.assertEqual(rel_data.resolve(), shared.resolve())


if __name__ == "__main__":
    unittest.main()
