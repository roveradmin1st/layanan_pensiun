#!/usr/bin/env python3
"""Check a prepared candidate on a temporary copy and private loopback ports.

Never starts PM2, loads the live runtime.env or accepts an external API URL.
Only the temporary database receives login/password-change test writes.
"""
from __future__ import annotations

import argparse
from contextlib import closing
import hashlib
import http.client
import importlib.util
import json
import os
from pathlib import Path
import secrets
import shutil
import sqlite3
import subprocess
import tempfile
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
BUSINESS = ('leads','lead_requests','applications','simulations','claims','imports','parameter_proposals')


def require(condition, stage):
    if not condition: raise RuntimeError(stage)


def digest(path):
    with path.open('rb') as stream: return hashlib.file_digest(stream,'sha256').hexdigest()


def state_at(path):
    with closing(sqlite3.connect(path.resolve(strict=True).as_uri()+'?mode=ro',uri=True,timeout=10)) as db:
        db.execute('BEGIN')
        require(db.execute('PRAGMA quick_check').fetchall()==[('ok',)],'sqlite_integrity')
        state=json.loads(db.execute("SELECT payload FROM kv_store WHERE collection='enterprise_state'").fetchone()[0])
        files=db.execute('SELECT COUNT(*) FROM uploaded_files').fetchone()[0]
    return state,files


def request(base, route, body=None, token=None):
    url=urlsplit(base)
    require(url.scheme=='http' and url.hostname=='127.0.0.1' and url.port is not None,'private_loopback_target')
    headers={}
    if token: headers['Authorization']='Bearer '+token
    payload=None
    if body is not None:
        headers['Content-Type']='application/json';payload=json.dumps(body).encode()
    connection=http.client.HTTPConnection('127.0.0.1',url.port,timeout=10)
    try:
        connection.request('POST' if body is not None else 'GET',route,body=payload,headers=headers)
        response=connection.getresponse();raw=response.read()
        result=json.loads(raw) if 'application/json' in response.getheader('Content-Type','') else None
        return response.status,{key.lower():value for key,value in response.getheaders()},result
    finally: connection.close()


def check_candidate(repo, candidate, *, private_root=None):
    repo=repo.resolve(strict=True)
    require(not candidate.is_symlink() and not (candidate/'production.sqlite').is_symlink(),'candidate_cannot_be_symlink')
    candidate=candidate.resolve(strict=True)
    require(not candidate.is_relative_to('/srv'),'candidate_must_be_offline_private_copy')
    require((repo/'frontend/dist/index.html').is_file() and (repo/'backend/node_modules').is_dir(),'build_required')
    manifest=json.loads((candidate/'result.json').read_text())
    require(manifest.get('status')=='candidate_prepared' and manifest.get('live_database_modified') is False,'prepared_candidate_manifest')
    database=candidate/'production.sqlite';password_file=candidate/'credentials.private.json'
    original_hash=digest(database);password_hash=digest(password_file)
    require(original_hash==manifest['candidate_sha256'],'candidate_checksum_before_test')
    original,files=state_at(database)
    require(original.get('meta',{}).get('production_format')=='lp-production-20261109-v1','production_data_format')
    require(not files and all(not original[key] for key in BUSINESS),'candidate_business_data_empty')
    credentials=json.loads(password_file.read_text())['accounts']
    active={user['id']:user for user in original['users'] if user.get('active',True) is not False}
    require(len(credentials)==len(active)==manifest['active_accounts'],'active_credential_count')
    require({entry['id'] for entry in credentials}==set(active),'active_credential_membership')
    plan=json.loads((candidate/'plan.json').read_text())
    primary_id=plan['protected_selectors']['primary_superadmin_email']
    primary=next(entry for entry in credentials if entry['id']==primary_id)
    require(active[primary_id]['role']=='super_admin','primary_superadmin')
    spec=importlib.util.spec_from_file_location('lp_candidate_ci',repo/'ops/ci.py')
    ci=importlib.util.module_from_spec(spec);spec.loader.exec_module(ci)
    # Readiness probes, like all credential requests, must remain on loopback.
    ci.request=request
    personal='Candidate-check-'+secrets.token_urlsafe(24)+'!'
    checked=0
    try:
        with tempfile.TemporaryDirectory(prefix='lp-candidate-check-',dir=private_root or Path.home()) as directory:
            work=Path(directory)
            shutil.copytree(repo/'backend/src',work/'backend/src')
            shutil.copyfile(repo/'backend/package.json',work/'backend/package.json')
            (work/'backend/node_modules').symlink_to(repo/'backend/node_modules',target_is_directory=True)
            (work/'backend/data').mkdir(mode=0o700)
            # A physical copy is required; Node changes the test DB's journal mode.
            shutil.copyfile(database,work/'backend/data/enterprise.sqlite')
            (work/'backend/data/enterprise.sqlite').chmod(0o600)
            (work/'frontend').mkdir()
            (work/'frontend/dist').symlink_to(repo/'frontend/dist',target_is_directory=True)
            with ci.server(work,'production',work/'first-start.log') as base:
                require(request(base,'/')[0]==200,'built_frontend_page')
                require(request(base,'/api/users')[0]==401,'anonymous_api_denied')
                require(request(base,'/api/auth/quick-role',{'role':'super_admin'})[0]==403,'quick_role_disabled')
                primary_token=None
                for index,entry in enumerate(credentials,1):
                    status,headers,body=request(base,'/api/auth/login',{'email':entry['email'],'password':entry['temporary_password']})
                    require(status==200,f'candidate_login_{index}')
                    cookie=headers.get('set-cookie','')
                    require('Secure' in cookie and 'HttpOnly' in cookie,'secure_session_cookie')
                    token=body['access_token']
                    status,_,user=request(base,'/api/auth/me',token=token)
                    expected=active[entry['id']]
                    require(status==200 and user['id']==entry['id'] and user['role']==expected['role'],'candidate_identity_and_role')
                    require(user['bank_scope']==(expected.get('bank_scope') or 'all_bank'),'candidate_bank_scope')
                    if expected.get('branch') in ('PEMATNGSIANTAR','BSI SIANTAR 2'):
                        require(user['branch']=='PEMATANGSIANTAR','approved_siantar_branch')
                    require(user['must_change_password'] is True,'first_login_password_gate')
                    require(user['capabilities']['web_restore'] is False,'production_restore_capability')
                    status,_,denied=request(base,'/api/leads',token=token)
                    require(status==403 and denied.get('error_code')=='PASSWORD_CHANGE_REQUIRED','gate_before_business_access')
                    if entry['id']==primary_id: primary_token=token
                    checked+=1
                status,_,changed=request(base,'/api/auth/change-password',{
                    'current_password':primary['temporary_password'],'new_password':personal},primary_token)
                require(status==200,'test_copy_password_change')
                require(request(base,'/api/auth/me',token=primary_token)[0]==401,'old_session_revoked_on_test_copy')
                status,_,users=request(base,'/api/users',token=changed['access_token'])
                require(status==200 and len(users)==len(original['users']),'business_access_after_password_change')
                require(request(base,'/api/backup/restore',{},changed['access_token'])[0]==403,'production_web_restore_blocked')
            # The second cold start must preserve the copy's data, not seed demos.
            with ci.server(work,'production',work/'second-start.log') as base:
                status,_,body=request(base,'/api/auth/login',{'email':primary['email'],'password':personal})
                require(status==200 and body['user']['must_change_password'] is False,'cold_restart_password_persists')
                require(request(base,'/api/leads',token=body['access_token'])[0]==200,'cold_restart_authenticated_access')
            after,files=state_at(work/'backend/data/enterprise.sqlite')
            require(not files and all(not after[key] for key in BUSINESS),'cold_restart_no_demo_data')
            require(len(after['users'])==len(original['users']),'cold_restart_user_count')
            require(after['partner_parameters']==original['partner_parameters'],'bank_parameters_preserved')
    finally:
        # Never return success if a source candidate or private password file changed.
        require(digest(database)==original_hash,'original_candidate_unchanged')
        require(digest(password_file)==password_hash,'original_credentials_unchanged')
    commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()
    return {'status':'candidate_smoke_passed','code_commit':commit,
        'node':subprocess.check_output(['node','--version'],text=True).strip(),
        'candidate_sha256':original_hash,'active_logins_checked':checked,
        'first_login_password_gate':True,'test_copy_password_change':True,
        'cold_restart_without_demo':True,'bank_scope_preserved':True,
        'original_candidate_unchanged':True,'original_credentials_unchanged':True,
        'loopback_only':True,'live_database_modified':False,'temporary_processes_stopped':True}


def main():
    os.umask(0o077)
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--candidate',type=Path,required=True)
    args=parser.parse_args()
    result=check_candidate(ROOT,args.candidate)
    # Metadata only. Never write tokens, passwords, HTTP bodies or runtime.env.
    parent=args.candidate.resolve().parent
    with tempfile.NamedTemporaryFile(mode='w',dir=parent,delete=False) as stream:
        temporary=Path(stream.name);os.fchmod(stream.fileno(),0o600)
        json.dump(result,stream,indent=2);stream.write('\n');stream.flush();os.fsync(stream.fileno())
    os.replace(temporary,parent/'candidate-check.json')
    print('UJI KANDIDAT BERHASIL')
    print(json.dumps(result,indent=2))


if __name__=='__main__':
    try: main()
    except Exception as error:
        message=str(error) if isinstance(error,RuntimeError) else type(error).__name__
        print('Uji kandidat berhenti: '+message)
        raise SystemExit(1)
