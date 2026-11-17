"""Run the actual workflow download step against a disposable GitHub CLI.

The PR run is deliberately newer than the push run and publishes a merge-SHA
artifact. No network, SSH, production database or GitHub credentials are used.
"""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
COMMIT = "1" * 40


class DeploymentArtifactSelectionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="lp-artifact-selection-")
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        workflow = (ROOT / ".github/workflows/deploy.yml").read_text()
        step = workflow.split("      - name: Download Runtime Release Artifact from CI\n", 1)[1]
        block = step.split("        run: |\n", 1)[1].split("\n      - name:", 1)[0]
        self.script = "\n".join(line[10:] for line in block.splitlines())
        # Keep the workflow's temporary files private to this test run.
        self.script = self.script.replace("/tmp/release-artifact", str(self.root / "artifact"))
        fake_gh = self.root / "gh"
        fake_gh.write_text('''#!/usr/bin/env python3
import json, os, pathlib, sys
args = sys.argv[1:]
case = os.environ.get("TEST_SCENARIO", "ok")
with open(os.environ["TEST_GH_CALLS"], "a") as log:
    log.write(json.dumps(args) + "\\n")
if args[:2] == ["run", "list"]:
    if case == "no_success":
        print("null")
    else:
        # Without --event=push GitHub returns the newer PR run first.
        print("101" if "--event=push" in args else "202")
elif args[:2] == ["run", "view"]:
    field = args[args.index("--json") + 1]
    values = {"event": "push", "headSha": os.environ["TARGET_SHA"], "conclusion": "success"}
    if args[2] == "202" or case == "wrong_event":
        values.update(event="pull_request")
    if case == "wrong_sha":
        values.update(headSha="2" * 40)
    if case == "wrong_result":
        values.update(conclusion="failure")
    print(values[field])
elif args[:2] == ["run", "download"]:
    expected = "runtime-release-" + os.environ["TARGET_SHA"]
    if args[2] != "101" or args[args.index("--name") + 1] != expected:
        sys.exit("Wrong CI run or merge-SHA artifact requested")
    target = pathlib.Path(args[args.index("--dir") + 1])
    target.mkdir(parents=True, exist_ok=True)
    name = "wrong.tar.gz" if case == "wrong_archive" else "release-" + os.environ["TARGET_SHA"] + ".tar.gz"
    (target / name).write_bytes(b"synthetic runtime archive")
else:
    sys.exit("Unexpected GitHub CLI command")
''')
        fake_gh.chmod(0o700)

    def run_step(self, scenario="ok"):
        env = {
            **os.environ,
            "PATH": str(self.root) + os.pathsep + os.environ["PATH"],
            "TARGET_SHA": COMMIT,
            "GITHUB_ENV": str(self.root / "github-env"),
            "TEST_GH_CALLS": str(self.root / "gh-calls.jsonl"),
            "TEST_SCENARIO": scenario,
        }
        return subprocess.run(
            ["bash", "--noprofile", "--norc", "-e", "-o", "pipefail", "-c", self.script],
            env=env, text=True, capture_output=True, timeout=15,
        )

    def test_push_artifact_selected_when_pr_run_is_newer(self):
        result = self.run_step()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn(
            f"ARCHIVE_PATH={self.root}/artifact/release-{COMMIT}.tar.gz",
            (self.root / "github-env").read_text(),
        )

    def test_wrong_run_identity_is_rejected_before_download(self):
        for scenario in ("wrong_event", "wrong_sha", "wrong_result", "no_success"):
            with self.subTest(scenario=scenario):
                calls = self.root / "gh-calls.jsonl"
                calls.unlink(missing_ok=True)
                result = self.run_step(scenario)
                self.assertNotEqual(result.returncode, 0, result.stdout)
                self.assertNotIn('"download"', calls.read_text())
                self.assertFalse((self.root / "github-env").exists())

    def test_unexpected_archive_filename_is_rejected(self):
        result = self.run_step("wrong_archive")
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertFalse((self.root / "github-env").exists())


if __name__ == "__main__":
    unittest.main()
