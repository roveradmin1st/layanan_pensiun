import copy
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import tempfile
import unittest

from ops import production as p


def fixture(path):
    users=[]
    for ident,role in [('primary','super_admin'),('ceo','admin_branch'),('agung','marketing'),
                       ('ops-a','admin_ops'),('ops-b','admin_ops'),('branch-a','admin_branch'),('branch-b','admin_branch'),
                       ('marketing-other','marketing'),('manager-other','sales_manager')]:
        users.append({'id':ident,'name':ident,'email':ident+'@example.test','role':role,'branch':'BANDUNG',
            'bank_scope':'bsi_only' if ident=='ceo' else 'all_bank','active':ident!='ops-b',
            'password_hash':hashlib.sha256(b'old-private-fixture-password').hexdigest()})
    state={key:[{'id':key+'-record','sentinel':'archive this customer input'}] for key in p.CLEAR}
    state.update(users=users,partner_parameters={'version':'approved','bsi_prapen':{'schemaVersion':2,
        'products':{key:{'policyVersion':'approved-policy','loan':{'maxPlafondAbsolute':750000000}} for key in ('PP3','PP10','PENSIUN')}},
        'bank_custom':{'rate':8.7}},meta={'provinces':['Jawa Barat']},parameter_migration_snapshots=[{'migration_id':'preserve-approved-policy'}])
    with sqlite3.connect(path) as db:
        db.executescript('CREATE TABLE kv_store(collection TEXT PRIMARY KEY,payload TEXT,updated_at TEXT); CREATE TABLE uploaded_files(id TEXT PRIMARY KEY,filename TEXT,mime_type TEXT,data BLOB,created_at TEXT);')
        db.execute('INSERT INTO kv_store VALUES(?,?,?)',('enterprise_state',json.dumps(state),'before'))
        db.execute('INSERT INTO uploaded_files VALUES(?,?,?,?,?)',('archive-doc','private.pdf','application/pdf',b'ACTUAL CUSTOMER DOCUMENT BYTES','before'))
    db.close()
    return state


class ProductionPreparationTests(unittest.TestCase):
    def test_python_candidate_starts_twice_under_node_production_without_demo_reseed(self):
        plan=p.make_plan(self.source,self.policy)
        output=self.root/'candidate-node'
        p.prepare(self.source,plan,output)
        before=p.read_snapshot(output/'production.sqlite')[0]
        root=Path(__file__).resolve().parents[2]
        backend=self.root/'node/backend'
        shutil.copytree(root/'backend/src',backend/'src')
        (backend/'node_modules').symlink_to(root/'backend/node_modules',target_is_directory=True)
        (backend/'package.json').write_text('{"type":"module"}')
        (backend/'data').mkdir()
        shutil.copyfile(output/'production.sqlite',backend/'data/enterprise.sqlite')
        code="import {getStore,db} from './src/db/database.js';const s=getStore();if(s.leads.length||s.applications.length||s.claims.length)throw Error('Demo data returned');db.close();"
        for _ in range(2):
            result=subprocess.run(['node','--input-type=module','-e',code],cwd=backend,
                                  env={**os.environ,'NODE_ENV':'production'},capture_output=True,text=True,timeout=30)
            self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(p.read_snapshot(backend/'data/enterprise.sqlite')[0],before)

    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name);self.source=self.root/'snapshot.sqlite'
        self.state=fixture(self.source)
        self.policy={'primary_superadmin_email':'primary@example.test','ceo_email':'ceo@example.test','agung_email':'agung@example.test'}
    def tearDown(self):self.temp.cleanup()
    def plan(self):return p.make_plan(self.source,self.policy)
    def update(self,state):
        with sqlite3.connect(self.source) as db:db.execute('UPDATE kv_store SET payload=?',(json.dumps(state),))
        db.close()
    def test_inventory_never_exports_password_hashes_or_document_bytes(self):
        before=p.file_hash(self.source);value=p.inventory(self.source);raw=json.dumps(value)
        self.assertNotIn('password_hash',raw);self.assertNotIn('ACTUAL CUSTOMER',raw)
        self.assertEqual(value['counts']['files'],1);self.assertEqual(before,p.file_hash(self.source))
    def test_plan_keeps_every_operational_and_branch_admin_and_exact_accounts(self):
        plan=self.plan();byid={user['id']:user for user in plan['accounts']}
        for ident in ('primary','ceo','agung','ops-a','ops-b','branch-a','branch-b'):self.assertTrue(byid[ident]['retained'])
        self.assertFalse(byid['marketing-other']['retained']);self.assertEqual(byid['ceo']['proposed_role'],'super_admin')
        self.assertEqual(byid['agung']['proposed_role'],'marketing');self.assertFalse(byid['ops-b']['proposed_active'])
    def test_email_typo_fails_without_fuzzy_matching_or_source_changes(self):
        before=p.file_hash(self.source);self.policy['agung_email']='agung-typo@example.test'
        with self.assertRaisesRegex(ValueError,'not found'):self.plan()
        self.assertEqual(before,p.file_hash(self.source))
    def test_prepare_builds_private_candidate_and_preserves_source_masters_and_roles(self):
        before=p.file_hash(self.source);output=self.root/'candidate';result=p.prepare(self.source,self.plan(),output)
        state,files,_=p.read_snapshot(output/'production.sqlite')
        self.assertFalse(result['live_database_modified']);self.assertFalse(files)
        for key in p.CLEAR:
            self.assertEqual(len(state[key]),1 if key=='audit_logs' else 0)
        self.assertEqual(state['partner_parameters'],self.state['partner_parameters'])
        self.assertEqual(state['parameter_migration_snapshots'],self.state['parameter_migration_snapshots'])
        byid={user['id']:user for user in state['users']}
        self.assertEqual(byid['agung']['role'],'marketing');self.assertEqual(byid['ceo']['role'],'super_admin')
        self.assertEqual(byid['ceo']['bank_scope'],'all_bank');self.assertFalse(byid['ops-b']['active'])
        self.assertFalse(byid['marketing-other']['active']);self.assertTrue(byid['branch-b']['active'])
        self.assertEqual(before,p.file_hash(self.source))
        self.assertEqual((output.stat().st_mode&0o777),0o700)
        for name in ('production.sqlite','credentials.private.json','result.json','plan.json'):
            self.assertEqual((output/name).stat().st_mode&0o777,0o600)
        private=json.loads((output/'credentials.private.json').read_text())
        first=private['accounts'][0]
        encoded=byid[first['id']]['password_hash']
        script="import fs from 'node:fs';import {verifyPassword} from './backend/src/security/passwords.js';const x=JSON.parse(fs.readFileSync(0,'utf8'));process.exit((await verifyPassword(x.password,x.hash)).valid?0:1);"
        check=subprocess.run(['node','--input-type=module','-e',script],cwd=Path(__file__).resolve().parents[2],
            input=json.dumps({'password':first['temporary_password'],'hash':encoded}),text=True,capture_output=True)
        self.assertEqual(check.returncode,0,check.stderr)
        with self.assertRaises(FileExistsError):p.prepare(self.source,self.plan(),output)
    def test_new_input_after_plan_blocks_prepare(self):
        plan=self.plan();self.state['leads'].append({'id':'new-client-input'});self.update(self.state)
        with self.assertRaisesRegex(ValueError,'changed after review'):p.prepare(self.source,plan,self.root/'candidate')
        self.assertFalse((self.root/'candidate').exists())
        self.assertEqual(len(p.read_snapshot(self.source)[0]['leads']),2)
    def test_tampered_plan_and_removed_admins_are_rejected(self):
        plan=self.plan();plan['accounts'][0]['retained']=False
        with self.assertRaisesRegex(ValueError,'checksum'):p.prepare(self.source,plan,self.root/'candidate')
        plan=self.plan()
        next(user for user in plan['accounts'] if user['id']=='ops-a')['retained']=False
        body=dict(plan);body.pop('plan_sha256');plan['plan_sha256']=p.hash_value(body)
        with self.assertRaisesRegex(ValueError,'Required accounts'):p.prepare(self.source,plan,self.root/'candidate')
    def test_live_path_and_unreviewed_manager_dependency_are_blocked(self):
        folder=self.root/'shared/data';folder.mkdir(parents=True);live=folder/'enterprise.sqlite';live.write_bytes(self.source.read_bytes())
        with self.assertRaisesRegex(ValueError,'offline snapshot'):p.prepare(live,self.plan(),self.root/'candidate')
        self.state['users'][2]['manager_id']='manager-other';self.update(self.state);plan=self.plan()
        self.assertEqual(len(plan['unresolved_manager_dependencies']),1)
        with self.assertRaisesRegex(ValueError,'manager dependencies'):p.prepare(self.source,plan,self.root/'candidate')
        self.policy['extra_keep_emails']=['manager-other@example.test'];self.assertFalse(self.plan()['unresolved_manager_dependencies'])
    def test_unknown_collections_and_duplicate_ids_stop_preparation(self):
        self.state['unreviewed_customer_data']=[{'id':'sensitive'}];self.update(self.state)
        with self.assertRaisesRegex(ValueError,'Unknown state'):p.inventory(self.source)
        self.state.pop('unreviewed_customer_data');self.state['leads'].append(self.state['leads'][0]);self.update(self.state)
        with self.assertRaisesRegex(ValueError,'duplicate'):p.inventory(self.source)


if __name__=='__main__':unittest.main()
