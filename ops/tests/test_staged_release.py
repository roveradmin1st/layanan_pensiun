import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock

from ops import production as p
from ops import check_staged_release as staged
from test_production import fixture


class StagedReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='lp-staged-test-');self.root=Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)
        self.base=self.root/'installation';self.release=self.base/'releases/new'
        self.old=self.base/'releases/old';self.old.mkdir(parents=True)
        (self.base/'current').symlink_to(self.old)
        shared=self.base/'shared/data';shared.mkdir(parents=True)
        self.live=shared/'enterprise.sqlite';self.live.write_bytes(b'LIVE-SENTINEL-MUST-NOT-BE-OPENED')
        self.home=self.root/'service-home';self.home.mkdir()
        self.app=SimpleNamespace(pw_uid=os.getuid(),pw_gid=os.getgid(),pw_dir=str(self.home))
        self.node=shutil.which('node');self.commit='f'*40
        repo=Path(__file__).resolve().parents[2]
        for folder in ('src','node_modules'):
            shutil.copytree(repo/'backend'/folder,self.release/'backend'/folder,symlinks=True)
        for name in ('package.json','package-lock.json'):
            shutil.copyfile(repo/'backend'/name,self.release/'backend'/name)
        frontend=self.release/'frontend/dist';frontend.mkdir(parents=True)
        (frontend/'index.html').write_text('<!doctype html><title>Synthetic staged runtime</title>')
        version=subprocess.check_output([self.node,'--version'],text=True).strip().removeprefix('v')
        (self.release/'.node-version').write_text(version+'\n')
        manifest={'commit':self.commit,'status':'copied_not_activated','files':{}}
        for path in self.release.rglob('*'):
            if path.is_symlink():
                manifest['files'][str(path.relative_to(self.release))]={'symlink':os.readlink(path)}
            else:
                path.chmod(0o750 if path.is_dir() or path.stat().st_mode&0o111 else 0o640)
                if path.is_file():manifest['files'][str(path.relative_to(self.release))]={'sha256':staged.digest(path)}
        (self.release/'DEPLOYMENT.json').write_text(json.dumps(manifest));(self.release/'DEPLOYMENT.json').chmod(0o640)
        source=self.root/'archive.sqlite';fixture(source)
        policy={'primary_superadmin_email':'primary@example.test','ceo_email':'ceo@example.test','agung_email':'agung@example.test'}
        self.candidate=self.root/'candidate'
        result=p.prepare(source,p.make_plan(source,policy),self.candidate)
        # Auth checks have their own full integration in ops/ci.py. This fixture
        # receipt supplies metadata to exercise Unix/runtime lifecycle boundaries.
        proof={'status':'candidate_smoke_passed','code_commit':self.commit,
               'candidate_sha256':result['candidate_sha256'],'active_logins_checked':result['active_accounts'],
               'live_database_modified':False,'first_login_password_gate':True,'bank_scope_preserved':True,
               'original_candidate_unchanged':True,'original_credentials_unchanged':True}
        (self.root/'candidate-check.json').write_text(json.dumps(proof))
        self.candidate_before=staged.digest(self.candidate/'production.sqlite')
        self.credentials_before=staged.digest(self.candidate/'credentials.private.json')

    def run_check(self):
        return staged.check_release(self.release,self.candidate,self.commit,base=self.base,app=self.app,node=self.node)

    def assert_originals_and_cleanup(self):
        self.assertEqual((self.base/'current').resolve(),self.old)
        self.assertEqual(self.live.read_bytes(),b'LIVE-SENTINEL-MUST-NOT-BE-OPENED')
        self.assertEqual(list(self.live.parent.iterdir()),[self.live])
        self.assertFalse(os.path.lexists(self.release/'backend/data'))
        self.assertEqual(list(self.home.iterdir()),[])
        self.assertEqual(staged.digest(self.candidate/'production.sqlite'),self.candidate_before)
        self.assertEqual(staged.digest(self.candidate/'credentials.private.json'),self.credentials_before)

    def test_two_real_node_starts_keep_live_sentinel_candidate_credentials_and_current_untouched(self):
        result=self.run_check()
        self.assertEqual(result['status'],'lpapp_release_check_passed')
        self.assertEqual(result['cold_starts'],2)
        self.assertTrue(result['temporary_processes_stopped'])
        self.assertTrue(result['loopback_only'])
        self.assertFalse(result['release_data_link_present'])
        self.assertEqual((self.release/'LPAPP-CHECK.json').stat().st_mode&0o777,0o640)
        self.assert_originals_and_cleanup()

    def test_modified_code_is_rejected_and_post_start_failure_stops_child_and_removes_test_link(self):
        index=self.release/'frontend/dist/index.html';before=index.read_text();index.write_text('unexpected edit')
        with self.assertRaisesRegex(RuntimeError,'Checksum'):self.run_check()
        self.assert_originals_and_cleanup();index.write_text(before)
        original_request=staged.request;original_popen=subprocess.Popen;children=[]
        def fail_after_start(port,route,body=None):
            if route=='/':raise RuntimeError('synthetic failure after startup')
            return original_request(port,route,body)
        def track(*args,**kwargs):
            proc=original_popen(*args,**kwargs);children.append(proc);return proc
        with mock.patch.object(staged,'request',side_effect=fail_after_start),mock.patch.object(subprocess,'Popen',side_effect=track):
            with self.assertRaisesRegex(RuntimeError,'synthetic failure after startup'):self.run_check()
        self.assertTrue(any(proc.args[-1]=='src/server.js' for proc in children))
        self.assertTrue(all(proc.poll() is not None for proc in children))
        self.assertFalse((self.release/'LPAPP-CHECK.json').exists())
        self.assert_originals_and_cleanup()


if __name__=='__main__':unittest.main()
