#!/usr/bin/env python3
"""Read-only VPS checks. Prints outcomes only, never environment or PM2 secrets."""
from contextlib import closing
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import pwd
import re
import shlex
import shutil
import sqlite3
import stat
import subprocess
import sys

BASE = Path('/srv/layanan-pensiunan')
CERT = Path('/etc/letsencrypt/live/layanan-pensiunan-ip/fullchain.pem')
ENV = Path('/etc/layanan-pensiunan/runtime.env')
IP = '139.190.106.136'
DEFAULT_PASSWORDS = ('Password123!','admin123','password','changeme','12345678','123456789012')


def run(args, timeout=20):
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout, cwd='/')


def parse_env(text):
    values = {}
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith('#'):continue
        parts = shlex.split(line, comments=True)
        if parts and parts[0]=='export':parts=parts[1:]
        if len(parts)!=1 or '=' not in parts[0]:raise ValueError('Invalid runtime environment syntax.')
        key,value = parts[0].split('=',1);values[key]=value
    return values


def database_worker(path):
    if os.geteuid()==0:raise RuntimeError('Database inspection must run as lpapp.')
    with closing(sqlite3.connect(path.resolve(strict=True).as_uri()+'?mode=ro',uri=True,timeout=15)) as db:
        db.execute('BEGIN')
        if db.execute('PRAGMA quick_check').fetchall()!=[('ok',)]:raise RuntimeError('SQLite check failed.')
        state=json.loads(db.execute("SELECT payload FROM kv_store WHERE collection='enterprise_state'").fetchone()[0])
        defaults={hashlib.sha256(('lp_salt_2026_'+value).encode()).hexdigest() for value in DEFAULT_PASSWORDS}
        active=[user for user in state['users'] if user.get('active',True) is not False]
        return {'integrity':'ok','production_format':state.get('meta',{}).get('production_format'),
                'active_accounts':len(active),'active_superadmins':sum(user['role']=='super_admin' for user in active),
                'active_default_hashes':sum(user.get('password_hash') in defaults for user in active),
                'active_weak_hashes':sum(not re.fullmatch(r'scrypt\$131072\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}',user.get('password_hash','')) for user in active),
                'counts':{key:len(state[key]) for key in ('users','leads','lead_requests','applications','simulations','claims')},
                'files':db.execute('SELECT COUNT(*) FROM uploaded_files').fetchone()[0]}


def backup_health(marker, now=None):
    metadata=json.loads(marker.read_text())
    location=Path(metadata['backup'])
    if location.is_symlink() or not location.resolve(strict=True).is_relative_to(marker.parent.resolve()):raise ValueError('Invalid backup location.')
    info=location.stat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid!=0 or info.st_mode&0o077:raise ValueError('Backup permissions require review.')
    with location.open('rb') as stream:digest=hashlib.file_digest(stream,'sha256').hexdigest()
    age=((now or datetime.now(timezone.utc))-datetime.fromisoformat(metadata['created_at'])).total_seconds()
    return {'valid':metadata.get('integrity')=='ok' and digest==metadata.get('sha256') and 0<=age<=90*60,
            'age_minutes':round(age/60,1),'backup':str(location)}


def main():
    if len(sys.argv)==3 and sys.argv[1]=='--database-worker':
        print(json.dumps(database_worker(Path(sys.argv[2]))));return
    if len(sys.argv)!=1 or os.geteuid()!=0:raise RuntimeError('Run the installed doctor with sudo and no arguments.')
    checks=[]
    def check(name, work):
        try:
            value=work();ok=value if isinstance(value,bool) else value.get('ok',False)
            checks.append({'check':name,'ok':ok,**({} if isinstance(value,bool) else {key:item for key,item in value.items() if key!='ok'})})
        except Exception:
            checks.append({'check':name,'ok':False,'detail':'Inspection failed or requirement unavailable; inspect locally.'})
    app=pwd.getpwnam('lpapp')
    check('installed_operations_root_owned',lambda:Path(__file__).stat().st_uid==0 and not Path(__file__).stat().st_mode&0o022)
    def environment():
        info=ENV.stat();values=parse_env(ENV.read_text());secret=values.get('JWT_SECRET','')
        examples={'lp_enterprise_jwt_secret_2026_ams2_bsi','lp_production_jwt_secret_min32chars_key_2026_enterprise',
                  '4f8b9e1a3c7d5f2e6a0b8c4d2e9f1a3b5c7e9d0f2a4b6c8d1e3f5a7b9c0d2e4f','12345678901234567890123456789012'}
        return not ENV.is_symlink() and info.st_uid==0 and info.st_gid==app.pw_gid and info.st_mode&0o777==0o640 and values.get('NODE_ENV')=='production' and values.get('HOST')=='127.0.0.1' and values.get('PORT')=='4000' and len(secret.strip())>=32 and secret.strip() not in examples
    check('runtime_configuration_and_permissions',environment)
    def process():
        daemon=Path(app.pw_dir)/'.pm2/pm2.pid'
        if not daemon.is_file() or not Path('/proc',daemon.read_text().strip()).exists():return False
        result=run(['/usr/bin/sudo','-u','lpapp','-H','--','pm2','pid','layanan-pensiunan-api'])
        pids=[line.strip() for line in result.stdout.splitlines() if re.fullmatch('[1-9][0-9]*',line.strip())]
        if result.returncode or len(pids)!=1:return False
        proc=Path('/proc')/pids[0];cwd=(proc/'cwd').resolve(strict=True)
        configured=(BASE/'current').resolve(strict=True)
        return {'ok':proc.stat().st_uid==app.pw_uid and cwd==configured/'backend', 'pid':int(pids[0]),'cwd':str(cwd)}
    check('one_application_pid_matches_current',process)
    def listener():
        result=run(['ss','-lntp','sport = :4000'])
        addresses=[line.split()[3] for line in result.stdout.splitlines()[1:] if line.split()]
        return result.returncode==0 and addresses==['127.0.0.1:4000']
    check('backend_listens_only_on_loopback',listener)
    for unit in ('nginx.service','snap.certbot.renew.timer','lp-backup.timer'):
        check(unit+'_active',lambda unit=unit:run(['systemctl','is-active','--quiet',unit]).returncode==0)
        check(unit+'_enabled',lambda unit=unit:run(['systemctl','is-enabled','--quiet',unit]).returncode==0)
    check('pm2_startup_enabled',lambda:run(['systemctl','is-enabled','--quiet','pm2-lpapp.service']).returncode==0)
    check('nginx_configuration_valid',lambda:run(['nginx','-t']).returncode==0)
    def certificate():
        valid=run(['openssl','x509','-in',str(CERT),'-noout','-checkend','172800']).returncode==0
        san=run(['openssl','x509','-in',str(CERT),'-noout','-ext','subjectAltName'])
        return valid and san.returncode==0 and ('IP Address:'+IP) in san.stdout
    check('certificate_matches_ip_and_valid_for_48h',certificate)
    def http(url, expected):
        result=run(['curl','--silent','--show-error','--max-time','15','--noproxy','*','--output','/dev/null','--write-out','%{http_code}',url])
        return result.returncode==0 and result.stdout==str(expected)
    check('public_https_trust_and_page',lambda:http('https://'+IP+'/',200))
    check('anonymous_api_denied',lambda:http('http://127.0.0.1:4000/api/users',401))
    def database():
        result=run(['/usr/bin/sudo','-u','lpapp','-H','--','/usr/bin/python3','-I',str(Path(__file__).resolve()),'--database-worker',str(BASE/'shared/data/enterprise.sqlite')])
        if result.returncode:raise RuntimeError('Database inspection failed.')
        data=json.loads(result.stdout)
        return {'ok':data['production_format']=='lp-production-20261109-v1' and data['active_superadmins']>0 and data['active_default_hashes']==0 and data['active_weak_hashes']==0,**data}
    check('production_database_and_credentials',database)
    check('verified_local_backup_under_90_minutes',lambda:{'ok':(value:=backup_health(BASE/'backups/latest-verified.json'))['valid'],**value})
    check('disk_free_at_least_5_GiB',lambda:{'ok':(free:=shutil.disk_usage(BASE).free)>=5*1024**3,'free_GiB':round(free/1024**3,2)})
    result={'checks':checks,'server_checks_passed':all(item['ok'] for item in checks),
            'manual_evidence_required':['encrypted offsite copy on owner laptop + restore drill','PM2 saved list contains one fork only','real reboot/startup test','bank calculation acceptance and account/data-plan approval']}
    print(json.dumps(result,indent=2))
    if not result['server_checks_passed']:raise SystemExit(1)


if __name__=='__main__':
    try:main()
    except Exception:
        print('Doctor stopped; inspect installed paths and permissions locally. No secret values were printed.',file=sys.stderr);raise SystemExit(1)
