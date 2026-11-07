#!/usr/bin/env python3
"""Inspect a snapshot, review a plan, and generate a private production candidate.

All input SQLite connections are read-only. Preparation writes only to a new
output directory; applying a candidate to the VPS is a separate operator action.
"""
from __future__ import annotations

import argparse
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import secrets
import sqlite3
import sys

COLLECTIONS = ('users','leads','lead_requests','applications','simulations','claims','imports','audit_logs','parameter_proposals')
CLEAR = tuple(key for key in COLLECTIONS if key != 'users')
ROLES = {'super_admin','admin_ops','admin_branch','sales_manager','marketing'}
FIELDS = set(COLLECTIONS) | {'partner_parameters','parameter_migration_snapshots','meta'}
LIVE = Path('/srv/layanan-pensiunan/shared/data/enterprise.sqlite')


def canonical(value): return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()
def hash_value(value): return hashlib.sha256(canonical(value)).hexdigest()
def file_hash(path):
    with path.open('rb') as stream: return hashlib.file_digest(stream, 'sha256').hexdigest()


def private_json(path, value):
    with path.open('xb') as stream:
        os.fchmod(stream.fileno(), 0o600)
        stream.write(json.dumps(value, indent=2, ensure_ascii=False).encode() + b'\n')
        stream.flush(); os.fsync(stream.fileno())


def validate(state):
    if not isinstance(state, dict) or set(state) - FIELDS: raise ValueError('Unknown state fields require review before preparation.')
    for key in COLLECTIONS:
        if not isinstance(state.get(key), list): raise ValueError('Invalid collection: ' + key)
        ids = [row.get('id') for row in state[key] if isinstance(row, dict)]
        if len(ids) != len(state[key]) or any(not isinstance(value, str) or not value for value in ids) or len(ids) != len(set(ids)):
            raise ValueError('Missing/duplicate IDs: ' + key)
    emails = [str(user.get('email', '')).strip().lower() for user in state['users']]
    if any(not value or '@' not in value for value in emails) or len(emails) != len(set(emails)): raise ValueError('Missing/duplicate account email.')
    if not isinstance(state.get('partner_parameters'), dict) or not isinstance(state.get('meta'), dict): raise ValueError('Invalid master configuration.')
    bsi = state['partner_parameters'].get('bsi_prapen', {})
    if bsi.get('schemaVersion') != 2 or not all(bsi.get('products', {}).get(code) for code in ('PP3','PP10','PENSIUN')):
        raise ValueError('Use the verified BSI schemaVersion2 snapshot.')


def read_snapshot(path):
    path = path.resolve(strict=True)
    with closing(sqlite3.connect(path.as_uri() + '?mode=ro', uri=True, timeout=30)) as db:
        db.execute('BEGIN')
        if db.execute('PRAGMA integrity_check').fetchall() != [('ok',)]: raise ValueError('SQLite integrity failed.')
        row = db.execute("SELECT payload FROM kv_store WHERE collection='enterprise_state'").fetchone()
        if row is None: raise ValueError('Application state is missing.')
        state = json.loads(row[0]); validate(state)
        files = {row[0]: hash_value([row[1],row[2],hashlib.sha256(row[3]).hexdigest(),row[4]])
                 for row in db.execute('SELECT id,filename,mime_type,data,created_at FROM uploaded_files')}
    return state, files, hash_value({'state':state, 'files':files})


def account(user):
    return {key:user.get(key) for key in ('id','name','email','role','branch','bank_scope','active','manager_id')}


def inventory(path):
    state, files, fingerprint = read_snapshot(path)
    return {'format':1, 'source_fingerprint':fingerprint,
            'counts':{key:len(state[key]) for key in COLLECTIONS} | {'files':len(files)},
            'accounts':[account(user) for user in state['users']]}


def make_plan(path, policy):
    required = ('primary_superadmin_email','ceo_email','agung_email')
    if any(not isinstance(policy.get(key), str) or not policy[key].strip() for key in required): raise ValueError('Specify all three protected account emails.')
    state, files, fingerprint = read_snapshot(path)
    by_email = {user['email'].strip().lower():user for user in state['users']}
    selected = {}
    for key in required:
        email = policy[key].strip().lower()
        if email not in by_email: raise ValueError('Protected account not found: ' + email + '. Check inventory; no fuzzy matching is used.')
        selected[key] = by_email[email]['id']
    primary = by_email[policy['primary_superadmin_email'].strip().lower()]
    if primary['role'] != 'super_admin': raise ValueError('Primary account is not currently a Super Admin; review the selector.')
    agung = by_email[policy['agung_email'].strip().lower()]
    if selected['ceo_email'] == agung['id'] and agung['role'] != 'super_admin': raise ValueError('CEO promotion conflicts with preserving Agung role.')
    keep = set(selected.values()) | {user['id'] for user in state['users'] if user['role'] in ('admin_ops','admin_branch')}
    for email in policy.get('extra_keep_emails', []):
        if email.strip().lower() not in by_email: raise ValueError('Extra retained account not found: ' + email)
        keep.add(by_email[email.strip().lower()]['id'])
    dependencies = []
    changes = []
    for user in state['users']:
        new = account(user)
        new['retained'] = user['id'] in keep
        new['proposed_active'] = user.get('active', True) is not False if new['retained'] else False
        new['proposed_role'] = 'super_admin' if user['id'] == selected['ceo_email'] else user['role']
        new['proposed_bank_scope'] = 'all_bank' if user['id'] == selected['ceo_email'] else user.get('bank_scope')
        if new['retained'] and user['role'] == 'marketing' and user.get('manager_id') and user['manager_id'] not in keep:
            dependencies.append({'user_id':user['id'],'manager_id':user['manager_id']})
        changes.append(new)
    plan = {'format':1,'database_format':'enterprise-state-bsi-products-v2','source_fingerprint':fingerprint,
            'source_counts':{key:len(state[key]) for key in COLLECTIONS} | {'files':len(files)},
            'source_records':{key:[{field:row[field] for field in ('id','lead_id','application_id','sim_id','sim_no','app_no','claim_no','created_at') if field in row} for row in state[key]] for key in CLEAR},
            'protected_selectors':selected, 'accounts':changes, 'unresolved_manager_dependencies':dependencies,
            'business_collections_to_clear':list(CLEAR),'uploaded_files_to_clear':len(files),
            'preserved_master':['partner_parameters','parameter_migration_snapshots','meta'],
            'credential_action':'rotate_every_account; issue_private_temporary_passwords_only_for_active_retained_accounts',
            'live_database_modified':False}
    plan['plan_sha256'] = hash_value(plan)
    return plan


def encode_password(value):
    salt = secrets.token_bytes(16)
    key = hashlib.scrypt(value.encode(), salt=salt, n=131072, r=8, p=1, dklen=64, maxmem=256*1024*1024)
    return 'scrypt$131072$8$1$' + salt.hex() + '$' + key.hex()


def prepare(path, plan, output):
    path = path.resolve(strict=True)
    if path == LIVE.resolve() or path.parent.parts[-2:] == ('shared','data'):
        raise ValueError('Prepare only from a verified offline snapshot, never shared/data.')
    source_file_hash = file_hash(path)
    expected_plan = dict(plan); provided = expected_plan.pop('plan_sha256', None)
    if provided != hash_value(expected_plan): raise ValueError('Plan checksum mismatch.')
    state, files, fingerprint = read_snapshot(path)
    if fingerprint != plan['source_fingerprint']: raise ValueError('Snapshot changed after review; create a fresh plan.')
    if plan['unresolved_manager_dependencies']: raise ValueError('Review retained Marketing manager dependencies first.')
    selected = plan['protected_selectors']
    keep = {row['id'] for row in plan['accounts'] if row['retained']}
    if set(row['id'] for row in plan['accounts']) != set(user['id'] for user in state['users']): raise ValueError('Account roster differs from the snapshot.')
    old_agung = dict(next(user for user in state['users'] if user['id'] == selected['agung_email']))
    protected_roles = {user['id'] for user in state['users'] if user['role'] in ('admin_ops','admin_branch')}
    if not protected_roles.issubset(keep) or not set(selected.values()).issubset(keep): raise ValueError('Required accounts were removed from plan.')
    output.mkdir(mode=0o700, parents=False, exist_ok=False)
    os.chmod(output, 0o700)
    candidate = output/'production.sqlite'
    with closing(sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)) as origin, closing(sqlite3.connect(candidate)) as copy:
        origin.backup(copy)
    os.chmod(candidate,0o600)
    credentials = []
    for user in state['users']:
        if user['id'] == selected['ceo_email']:
            user['role'] = 'super_admin'; user['bank_scope'] = 'all_bank'
        user['active'] = user.get('active', True) is not False if user['id'] in keep else False
        user['auth_version'] = (user.get('auth_version') if isinstance(user.get('auth_version'), int) else 0) + 1
        user['must_change_password'] = True
        temporary = 'Lp-' + secrets.token_urlsafe(24) + '!'
        user['password_hash'] = encode_password(temporary)
        if user['active']:
            credentials.append({'id':user['id'],'name':user['name'],'email':user['email'],'role':user['role'],'temporary_password':temporary})
        if user['role'] not in ROLES: raise ValueError('Unknown role requires review: ' + user['id'])
    agung = next(user for user in state['users'] if user['id'] == selected['agung_email'])
    if (agung['role'],agung.get('branch'),agung.get('bank_scope')) != (old_agung['role'],old_agung.get('branch'),old_agung.get('bank_scope')):
        raise ValueError('Agung role or scope would change.')
    if not any(user['active'] and user['role']=='super_admin' for user in state['users']): raise ValueError('No active Super Admin remains.')
    now = datetime.now(timezone.utc).isoformat()
    for key in CLEAR: state[key] = []
    state['audit_logs'] = [{'id':'aud-production-'+secrets.token_hex(12),'user_id':selected['primary_superadmin_email'],
        'user_name':'System','role':'system','action':'production_bootstrap','entity':'database',
        'detail':'Prepared from reviewed UAT archive; customer data cleared in candidate only.','ip':'127.0.0.1','created_at':now}]
    state['meta']['environment'] = 'production'
    state['meta']['production_format'] = 'lp-production-20261109-v1'
    state['meta']['production_prepared_at'] = now
    state['meta']['source_archive_fingerprint'] = fingerprint
    validate(state)
    with closing(sqlite3.connect(candidate)) as db:
        db.execute('PRAGMA secure_delete=ON')
        db.execute('BEGIN IMMEDIATE')
        db.execute("UPDATE kv_store SET payload=?,updated_at=? WHERE collection='enterprise_state'",(json.dumps(state,ensure_ascii=False),now))
        db.execute('DELETE FROM uploaded_files'); db.commit()
        db.execute('PRAGMA journal_mode=DELETE'); db.execute('VACUUM')
    after, new_files, new_fingerprint = read_snapshot(candidate)
    if new_files or any(after[key] for key in CLEAR if key!='audit_logs'): raise ValueError('Candidate still contains business test data.')
    if file_hash(path) != source_file_hash or read_snapshot(path)[2] != fingerprint: raise ValueError('Source archive changed.')
    private_json(output/'credentials.private.json',{'instruction':'Distribute privately to each account owner; never commit, screenshot or send to chat.','accounts':credentials})
    private_json(output/'plan.json',plan)
    result = {'status':'candidate_prepared','live_database_modified':False,'plan_sha256':provided,
              'candidate_sha256':file_hash(candidate),'candidate_fingerprint':new_fingerprint,
              'counts':{key:len(after[key]) for key in COLLECTIONS}|{'files':len(new_files)},
              'active_accounts':len(credentials),'credential_file':'credentials.private.json'}
    private_json(output/'result.json',result)
    return result


def main():
    os.umask(0o077)
    parser=argparse.ArgumentParser(description=__doc__)
    commands=parser.add_subparsers(dest='action',required=True)
    for name in ('inventory','plan','prepare','verify'):
        command=commands.add_parser(name);command.add_argument('--database',type=Path,required=True)
        if name=='plan':command.add_argument('--policy',type=Path,required=True);command.add_argument('--output',type=Path,required=True)
        if name=='prepare':command.add_argument('--plan',type=Path,required=True);command.add_argument('--output-dir',type=Path,required=True)
    args=parser.parse_args()
    if args.action=='inventory':result=inventory(args.database)
    elif args.action=='plan':
        result=make_plan(args.database,json.loads(args.policy.read_text()));private_json(args.output,result)
        result={'status':'plan_created','plan':str(args.output),'plan_sha256':result['plan_sha256'],'live_database_modified':False}
    elif args.action=='prepare':result=prepare(args.database,json.loads(args.plan.read_text()),args.output_dir)
    else:
        state,files,fingerprint=read_snapshot(args.database)
        result={'status':'verified','fingerprint':fingerprint,'counts':{key:len(state[key]) for key in COLLECTIONS}|{'files':len(files)}}
    print(json.dumps(result,indent=2))


if __name__=='__main__':
    try:main()
    except Exception as error:
        print('Preparation stopped: '+str(error),file=sys.stderr)
        raise SystemExit(1)
