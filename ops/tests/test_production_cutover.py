import copy
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock

from ops import production as p
from ops import production_cutover as c
from test_production import fixture


NGINX='''server {
 listen 80; server_name 139.190.106.136;
 location ^~ /.well-known/acme-challenge/ { root /var/www/lp-acme; try_files $uri =404; }
 location / { return 301 https://139.190.106.136$request_uri; }
}
server {
 listen 443 ssl; server_name 139.190.106.136;
 ssl_certificate /etc/letsencrypt/live/layanan-pensiunan-ip/fullchain.pem;
 ssl_certificate_key /etc/letsencrypt/live/layanan-pensiunan-ip/privkey.pem;
 location / {
  proxy_pass http://127.0.0.1:4000;
  proxy_http_version 1.1;
  proxy_set_header X-Forwarded-Proto $scheme;
 }
}
'''
ROOT_ATOMIC=c.atomic


def user_atomic(path,value,mode=0o600,uid=0,gid=0):
    return ROOT_ATOMIC(path,value,mode,os.getuid(),os.getgid())


class FakeRuntime:
    """System service seam; all directory moves/copies in the transaction are real."""
    def __init__(self,root,fail=None):
        self.base=root/'installation';self.db=self.base/'shared/data/enterprise.sqlite'
        self.db.parent.mkdir(parents=True);self.db.write_bytes(b'old-uat-database')
        for suffix in ('-wal','-shm'):Path(str(self.db)+suffix).write_bytes(b'old-sidecar'+suffix.encode())
        self.old=self.base/'releases/old';self.new=self.base/'releases/new'
        for release in (self.old,self.new):
            (release/'backend/src').mkdir(parents=True);(release/'backend/src/server.js').write_text('// synthetic')
        (self.base/'current').symlink_to(self.old)
        self.folder=self.base/'backups/cutover';self.folder.mkdir(parents=True)
        (self.folder/'nginx-before.conf').write_text(NGINX)
        (self.folder/'pm2-before.private.json').write_text('[]')
        prepared=self.folder/'candidate-data';prepared.mkdir();(prepared/'enterprise.sqlite').write_bytes(b'clean-production-candidate')
        self.original_candidate=root/'original-candidate.sqlite';self.original_candidate.write_bytes(b'clean-production-candidate')
        self.app=SimpleNamespace(pw_uid=os.getuid(),pw_gid=os.getgid())
        self.fail=fail;self.events=[];self.maintenance=False;self.did_race=False
        self.plan={'old_release':str(self.old),'new_release':str(self.new),'commit':'e'*40,
                   'source_fingerprint':c.hash_value('old-uat-database'),
                   'candidate_facts':{'fingerprint':c.hash_value('clean-production-candidate'),'active_accounts':11}}
        self.last_backup=None

    def current(self):return (self.base/'current').resolve()
    def nginx(self,text):
        self.maintenance='return 503' in text;self.events.append(('nginx',self.maintenance))
        if not self.maintenance and self.current()==self.new and self.fail=='open':
            with self.db.open('ab') as stream:stream.write(b'-ACTUAL-NEW-USER-INPUT')
            raise RuntimeError('synthetic failure after opening')
    def public_status(self,status):
        if status!=(503 if self.maintenance else 200):raise RuntimeError('unexpected public status')
    def stop(self):
        self.events.append(('stop',self.current()))
        if self.fail=='source_race' and not self.did_race:
            self.db.write_bytes(b'old-uat-database-with-new-input');self.did_race=True
    def facts(self,path):
        return {'fingerprint':c.hash_value(path.read_text()),'counts':{'users':27,'files':0}}
    def data_closed(self):
        if self.fail=='handles' and self.current()==self.old:raise RuntimeError('synthetic open database viewer')
    def snapshot(self,source,target):
        if self.fail=='snapshot' and target.name=='final-uat-snapshot':raise RuntimeError('synthetic snapshot failure')
        target.mkdir();shutil.copyfile(source,target/'database.sqlite')
        return self.facts(source)|{'backup':str(target/'database.sqlite'),'sha256':c.digest(target/'database.sqlite'),
                                   'integrity':'ok','created_at':datetime.now(timezone.utc).isoformat()}
    def point(self,release):
        (self.base/'current').unlink();(self.base/'current').symlink_to(release);self.events.append(('point',release))
    def start(self,release,folder):
        self.events.append(('start',release))
        if self.fail in ('start','rollback') and release==self.new:raise RuntimeError('synthetic start failure')
        if any(Path(str(self.db)+suffix).exists() for suffix in ('-wal','-shm')):raise RuntimeError('old sidecar mixed into new data')
    def healthy(self,release):
        if self.fail=='healthy' and release==self.new:raise RuntimeError('synthetic health failure')
    def persist(self,release):
        self.events.append(('persist',release))
        if self.fail=='persist' and release==self.new:raise RuntimeError('synthetic save failure')
    def resurrect(self,folder):
        self.events.append(('resurrect',self.old))
        if self.fail=='rollback':raise RuntimeError('synthetic recovery failure')
    def doctor(self,allowed):
        if self.fail=='doctor':raise RuntimeError('synthetic doctor failure')
    def publish_backup(self,metadata):self.last_backup=metadata


class CutoverTransactionTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='lp-cutover-test-');self.root=Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)
        patch=mock.patch.object(c,'atomic',side_effect=user_atomic);patch.start();self.addCleanup(patch.stop)

    def case(self,mode=None):
        root=self.root/(mode or 'success');root.mkdir();return FakeRuntime(root,mode)

    def test_success_archives_entire_old_directory_opens_new_pair_and_preserves_original_candidate(self):
        rt=self.case();result=c.apply_transaction(rt,rt.plan,rt.folder)
        self.assertEqual(result['status'],'production_active');self.assertEqual(rt.current(),rt.new)
        self.assertEqual(rt.db.read_bytes(),b'clean-production-candidate')
        self.assertEqual((rt.folder/'old-data/enterprise.sqlite').read_bytes(),b'old-uat-database')
        self.assertTrue((rt.folder/'old-data/enterprise.sqlite-wal').exists())
        self.assertTrue((rt.folder/'old-data/enterprise.sqlite-shm').exists())
        self.assertFalse(Path(str(rt.db)+'-wal').exists());self.assertFalse(rt.maintenance)
        self.assertEqual((rt.new/'backend/data').resolve(),rt.db.parent)
        self.assertEqual(rt.original_candidate.read_bytes(),b'clean-production-candidate')
        self.assertEqual(json.loads((rt.folder/'status.json').read_text())['status'],'active')
        self.assertEqual(Path(rt.last_backup['backup']).read_bytes(),b'clean-production-candidate')

    def test_failures_before_opening_restore_old_code_data_and_sidecars_without_restoring_a_snapshot(self):
        for mode in ('snapshot','handles','start','healthy','persist','doctor'):
            with self.subTest(mode=mode):
                rt=self.case(mode)
                with self.assertRaisesRegex(RuntimeError,'pasangan kode/data lama dipulihkan'):c.apply_transaction(rt,rt.plan,rt.folder)
                self.assertEqual(rt.current(),rt.old);self.assertEqual(rt.db.read_bytes(),b'old-uat-database')
                for suffix in ('-wal','-shm'):self.assertEqual(Path(str(rt.db)+suffix).read_bytes(),b'old-sidecar'+suffix.encode())
                self.assertFalse(os.path.lexists(rt.new/'backend/data'));self.assertFalse(rt.maintenance)
                self.assertEqual(rt.original_candidate.read_bytes(),b'clean-production-candidate')
                self.assertEqual(json.loads((rt.folder/'status.json').read_text())['status'],'old_pair_restored')
                self.assertIn(('resurrect',rt.old),rt.events)

    def test_failure_between_directory_moves_restores_the_original_directory(self):
        rt=self.case('between_moves');original_rename=os.rename
        def fail_once(source,target):
            if Path(source)==rt.folder/'candidate-data':raise OSError('synthetic interrupted rename')
            return original_rename(source,target)
        with mock.patch.object(os,'rename',side_effect=fail_once):
            with self.assertRaisesRegex(RuntimeError,'pasangan kode/data lama dipulihkan'):c.apply_transaction(rt,rt.plan,rt.folder)
        self.assertEqual(rt.db.read_bytes(),b'old-uat-database');self.assertEqual(rt.current(),rt.old)
        self.assertTrue(Path(str(rt.db)+'-wal').exists());self.assertFalse(rt.maintenance)

    def test_input_committed_before_stop_is_preserved_and_prevents_swap(self):
        rt=self.case('source_race')
        with self.assertRaisesRegex(RuntimeError,'pasangan kode/data lama dipulihkan'):c.apply_transaction(rt,rt.plan,rt.folder)
        self.assertEqual(rt.db.read_bytes(),b'old-uat-database-with-new-input')
        self.assertEqual(rt.current(),rt.old);self.assertFalse((rt.folder/'old-data').exists())
        self.assertNotIn(('start',rt.new),rt.events)

    def test_failure_after_possible_opening_never_rolls_back_new_user_input(self):
        rt=self.case('open')
        with self.assertRaisesRegex(RuntimeError,'Jangan restore snapshot lama'):c.apply_transaction(rt,rt.plan,rt.folder)
        self.assertEqual(rt.current(),rt.new)
        self.assertEqual(rt.db.read_bytes(),b'clean-production-candidate-ACTUAL-NEW-USER-INPUT')
        self.assertEqual((rt.folder/'old-data/enterprise.sqlite').read_bytes(),b'old-uat-database')
        self.assertNotIn(('resurrect',rt.old),rt.events);self.assertTrue(rt.maintenance)
        status=json.loads((rt.folder/'status.json').read_text())
        self.assertEqual(status['status'],'needs_manual_recovery_after_opening');self.assertTrue(status['public_maintenance_confirmed'])

    def test_recovery_failure_keeps_archives_and_records_manual_recovery(self):
        rt=self.case('rollback')
        with self.assertRaisesRegex(RuntimeError,'Pemulihan perlu pemeriksaan'):c.apply_transaction(rt,rt.plan,rt.folder)
        self.assertTrue(rt.maintenance);self.assertEqual(rt.db.read_bytes(),b'old-uat-database')
        self.assertEqual((rt.folder/'failed-new-data/enterprise.sqlite').read_bytes(),b'clean-production-candidate')
        self.assertEqual(json.loads((rt.folder/'status.json').read_text())['status'],'needs_manual_recovery_before_opening')

    def test_journal_failure_before_any_mutation_does_not_touch_running_application(self):
        rt=self.case('journal')
        with mock.patch.object(c,'atomic',side_effect=OSError('no journal space')):
            with self.assertRaises(OSError):c.apply_transaction(rt,rt.plan,rt.folder)
        self.assertEqual(rt.events,[]);self.assertEqual(rt.current(),rt.old)
        self.assertEqual(rt.db.read_bytes(),b'old-uat-database')


class CutoverValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='lp-cutover-validate-');self.root=Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)

    def test_readonly_worker_fingerprint_matches_offline_plan_including_document_bytes(self):
        source=self.root/'source.sqlite';fixture(source);before=c.digest(source)
        actual=c.facts_worker(source)
        self.assertEqual(actual['fingerprint'],p.read_snapshot(source)[2])
        self.assertEqual(actual['counts']['files'],1);self.assertEqual(actual['bsi_schema_version'],2)
        self.assertEqual(c.digest(source),before)
        with sqlite3.connect(source) as db:db.execute("UPDATE uploaded_files SET data=?",(b'changed actual bytes',))
        self.assertNotEqual(c.facts_worker(source)['fingerprint'],actual['fingerprint'])

    def test_maintenance_changes_only_application_proxy_and_preserves_acme_https_and_redirect(self):
        result=c.maintenance_text(NGINX)
        self.assertIn('/.well-known/acme-challenge/',result);self.assertIn('return 301 https://',result)
        self.assertIn('ssl_certificate_key',result);self.assertIn('return 503',result)
        self.assertNotIn('proxy_pass',result)
        with self.assertRaises(RuntimeError):c.maintenance_text(NGINX.replace('127.0.0.1:4000','127.0.0.1:5000'))
        with self.assertRaises(RuntimeError):c.maintenance_text(NGINX+' location /api { proxy_pass http://127.0.0.1:4000; }')

    def test_saved_list_requires_exactly_one_matching_fork_without_exposing_environment(self):
        release=self.root/'release';(release/'backend/src').mkdir(parents=True);(release/'backend/src/server.js').write_text('// fixture')
        row={'name':c.APP,'exec_mode':'fork_mode','instances':1,'pm_cwd':str(release/'backend'),
             'pm_exec_path':str(release/'backend/src/server.js'),'env':{'JWT_SECRET':'private-do-not-print'}}
        c.check_saved_list([row],release)
        for entries in ([row,row],[row|{'exec_mode':'cluster_mode'}],[row|{'instances':2}],[row|{'name':'other'}],[row|{'status':'stopped'}]):
            with self.assertRaises(RuntimeError) as error:c.check_saved_list(entries,release)
            self.assertNotIn('private-do-not-print',str(error.exception))

    def test_runtime_parser_does_not_expand_commands_or_allow_duplicate_keys(self):
        text="NODE_ENV=production\nHOST=127.0.0.1\nPORT=4000\nJWT_SECRET='$(never-execute)"+'x'*40+"'\n"
        self.assertIn('$(never-execute)',c.parse_env(text)['JWT_SECRET'])
        with self.assertRaises(RuntimeError):c.parse_env(text+'PORT=5000\n')


class CutoverPrepareTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='lp-cutover-prepare-');self.root=Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)
        self.base=self.root/'installation';self.release=self.base/'releases/new';self.old=self.base/'releases/old'
        (self.release/'backend').mkdir(parents=True);self.old.mkdir();(self.base/'current').symlink_to(self.old)
        self.db=self.base/'shared/data/enterprise.sqlite';self.db.parent.mkdir(parents=True);fixture(self.db)
        (self.release/'.node-version').write_text('24.22.2\n')
        self.commit='a'*40;(self.release/'DEPLOYMENT.json').write_text(json.dumps({'commit':self.commit}))
        policy={'primary_superadmin_email':'primary@example.test','ceo_email':'ceo@example.test','agung_email':'agung@example.test'}
        archive=self.root/'verified-offline-snapshot.sqlite';shutil.copyfile(self.db,archive)
        self.review=p.make_plan(archive,policy);self.candidate=self.root/'candidate'
        self.result=p.prepare(archive,self.review,self.candidate)
        self.proof={'candidate_sha256':self.result['candidate_sha256']}
        (self.release/'LPAPP-CHECK.json').write_text(json.dumps(self.proof))
        self.env=self.root/'runtime.env';self.env.write_text('private runtime configuration')
        self.conf=self.root/'nginx.conf';self.conf.write_text(NGINX)
        self.ops=self.root/'ops';self.ops.mkdir()
        for name in ('server_backup.py','server_doctor.py'):(self.ops/name).write_text('# fixture')
        self.dump=self.root/'dump.private.json';self.dump.write_text('[{"env":{"JWT_SECRET":"private"}}]')
        outer=self
        class PrepareRuntime:
            db=outer.db;app=SimpleNamespace(pw_uid=os.getuid(),pw_gid=os.getgid());dump=outer.dump
            def active(self):return outer.old
            def saved(self,release):pass
            def doctor(self,allowed):pass
            def command(self,*args,**kwargs):return SimpleNamespace(stdout='v24.22.2\n')
            def snapshot(self,source,target):
                target.mkdir();shutil.copyfile(source,target/'database.sqlite')
                return c.facts_worker(target/'database.sqlite')|{'backup':str(target/'database.sqlite'),'sha256':c.digest(target/'database.sqlite')}
            def inspect_copy(self,source):return c.facts_worker(source)
            def facts(self,source):return c.facts_worker(source)
        self.rt=PrepareRuntime()
        for name,value in [('BASE',self.base),('ENV',self.env),('CONF',self.conf),('OPS',self.ops)]:
            patch=mock.patch.object(c,name,value);patch.start();self.addCleanup(patch.stop)
        patch=mock.patch.object(c,'atomic',side_effect=user_atomic);patch.start();self.addCleanup(patch.stop)
        patch=mock.patch.object(c,'verify_release',return_value=self.proof);patch.start();self.addCleanup(patch.stop)

    def test_prepare_freezes_candidate_and_config_without_modifying_live_or_credentials(self):
        before={path:c.digest(path) for path in (self.db,self.env,self.conf,self.dump,self.candidate/'credentials.private.json')}
        result=c.prepare(self.rt,self.release,self.candidate,self.review['plan_sha256'])
        self.assertEqual(result['status'],'cutover_prepared');self.assertTrue(result['pm2_saved_single_fork'])
        self.assertFalse(result['maintenance_started']);self.assertFalse(result['live_database_modified'])
        self.assertEqual((self.base/'current').resolve(),self.old)
        for path,expected in before.items():self.assertEqual(c.digest(path),expected)
        plan=Path(result['plan']);self.assertEqual(plan.stat().st_mode&0o777,0o600)
        self.assertEqual(c.digest(plan.parent/'candidate-data/enterprise.sqlite'),self.result['candidate_sha256'])
        self.assertFalse(os.path.lexists(self.release/'backend/data'))
        data=json.loads(plan.read_text());provided=data.pop('plan_sha256');self.assertEqual(provided,c.hash_value(data))
        self.assertEqual(c.read_plan(plan,result['plan_sha256'])['commit'],self.commit)
        tampered=json.loads(plan.read_text());tampered['candidate_sha256']='0'*64;plan.write_text(json.dumps(tampered))
        with self.assertRaisesRegex(RuntimeError,'Checksum rencana'):c.read_plan(plan,result['plan_sha256'])

    def test_apply_rejects_new_input_before_maintenance_without_calling_transaction(self):
        result=c.prepare(self.rt,self.release,self.candidate,self.review['plan_sha256'])
        with sqlite3.connect(self.db) as db:
            state=json.loads(db.execute('SELECT payload FROM kv_store').fetchone()[0]);state['leads'].append({'id':'new-real-input'})
            db.execute('UPDATE kv_store SET payload=?',(json.dumps(state),))
        before=c.digest(self.db)
        with mock.patch.object(c,'apply_transaction') as action:
            with self.assertRaisesRegex(RuntimeError,'Data live berubah; belum ada maintenance'):
                c.apply(self.rt,Path(result['plan']),result['plan_sha256'])
            action.assert_not_called()
        self.assertEqual(c.digest(self.db),before);self.assertEqual((self.base/'current').resolve(),self.old)
        self.assertFalse(os.path.lexists(self.release/'backend/data'))

    def test_changed_source_is_archived_for_review_without_stopping_or_replacing_it(self):
        with sqlite3.connect(self.db) as db:
            state=json.loads(db.execute('SELECT payload FROM kv_store').fetchone()[0]);state['audit_logs'].append({'id':'new-login'})
            db.execute('UPDATE kv_store SET payload=?',(json.dumps(state),))
        before=c.digest(self.db)
        with self.assertRaisesRegex(RuntimeError,'Data live berubah sejak rencana awal'):
            c.prepare(self.rt,self.release,self.candidate,self.review['plan_sha256'])
        self.assertEqual(c.digest(self.db),before);self.assertEqual((self.base/'current').resolve(),self.old)
        folders=list((self.base/'backups').iterdir());self.assertEqual(len(folders),1)
        self.assertEqual(json.loads((folders[0]/'status.json').read_text())['status'],'source_changed_since_review')
        self.assertFalse((folders[0]/'plan.json').exists());self.assertFalse(os.path.lexists(self.release/'backend/data'))


if __name__=='__main__':unittest.main()
