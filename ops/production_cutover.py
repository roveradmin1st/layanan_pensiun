#!/usr/bin/env python3
"""Prepare a reviewed production cutover; apply only during an agreed maintenance window.

No passwords, environment contents or raw PM2 JSON are printed. Preparation
does not stop/restart the application or change current/shared/data/Nginx.
"""
from contextlib import closing, contextmanager
from datetime import datetime, timezone
import argparse
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
import signal
import sqlite3
import ssl
import subprocess
import sys
import tempfile
import time
import uuid

BASE=Path('/srv/layanan-pensiunan')
OPS=Path('/usr/local/lib/layanan-pensiunan/ops')
ENV=Path('/etc/layanan-pensiunan/runtime.env')
CONF=Path('/etc/nginx/sites-available/layanan-pensiunan-ip')
IP='139.190.106.136'
APP='layanan-pensiunan-api'
COLLECTIONS=('users','leads','lead_requests','applications','simulations','claims','imports','audit_logs','parameter_proposals')


def require(value,message):
    if not value:raise RuntimeError(message)


def canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()
def hash_value(value):return hashlib.sha256(canonical(value)).hexdigest()
def digest(path):
    with path.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()


def sync_dir(path):
    fd=os.open(path,os.O_DIRECTORY)
    try:os.fsync(fd)
    finally:os.close(fd)


def data_size(path):
    wal=Path(str(path)+'-wal')
    return path.stat().st_size+(wal.stat().st_size if wal.exists() else 0)


def atomic(path,value,mode=0o600,uid=0,gid=0):
    raw=value if isinstance(value,bytes) else (json.dumps(value,indent=2,ensure_ascii=False)+'\n').encode()
    fd,name=tempfile.mkstemp(dir=path.parent)
    try:
        with os.fdopen(fd,'wb') as stream:
            os.fchmod(stream.fileno(),mode);os.fchown(stream.fileno(),uid,gid)
            stream.write(raw);stream.flush();os.fsync(stream.fileno())
        os.replace(name,path)
        sync_dir(path.parent)
    finally:Path(name).unlink(missing_ok=True)


def move(source,target):
    os.rename(source,target)
    for parent in {source.parent,target.parent}:sync_dir(parent)


def facts_worker(path):
    require(os.geteuid()!=0,'Inspeksi database harus sebagai lpapp.')
    with closing(sqlite3.connect(path.resolve(strict=True).as_uri()+'?mode=ro',uri=True,timeout=30)) as db:
        db.execute('BEGIN')
        require(db.execute('PRAGMA integrity_check').fetchall()==[('ok',)],'SQLite tidak sehat.')
        state=json.loads(db.execute("SELECT payload FROM kv_store WHERE collection='enterprise_state'").fetchone()[0])
        files={row[0]:hash_value([row[1],row[2],hashlib.sha256(row[3]).hexdigest(),row[4]])
               for row in db.execute('SELECT id,filename,mime_type,data,created_at FROM uploaded_files')}
        active=[user for user in state['users'] if user.get('active',True) is not False]
        return {'fingerprint':hash_value({'state':state,'files':files}),
                'parameters_hash':hash_value(state['partner_parameters']),
                'migration_history_hash':hash_value(state.get('parameter_migration_snapshots')),
                'bsi_schema_version':state['partner_parameters'].get('bsi_prapen',{}).get('schemaVersion'),
                'production_format':state.get('meta',{}).get('production_format'),
                'active_accounts':len(active),'active_superadmins':sum(user['role']=='super_admin' for user in active),
                'active_weak_hashes':sum(not re.fullmatch(r'scrypt\$131072\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}',user.get('password_hash','')) for user in active),
                'counts':{key:len(state[key]) for key in COLLECTIONS}|{'files':len(files)}}


def maintenance_text(original):
    pattern=r'location\s+/\s*\{[^{}]*proxy_pass\s+http://127\.0\.0\.1:4000;[^{}]*\}'
    replacement='location / { default_type text/plain; add_header Retry-After 60 always; add_header Cache-Control "no-store" always; return 503 "Sedang pemeliharaan. Silakan coba beberapa menit lagi.\\n"; }'
    changed,count=re.subn(pattern,lambda _:replacement,original)
    require(count==1 and len(re.findall(r'\bproxy_pass\b',original))==1,'Konfigurasi proxy berbeda; belum ada perubahan.')
    return changed


def parse_env(text):
    values={}
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith('#'):continue
        parts=shlex.split(line,comments=True)
        if parts and parts[0]=='export':parts=parts[1:]
        require(len(parts)==1 and '=' in parts[0],'Sintaks runtime.env perlu diperiksa.')
        key,value=parts[0].split('=',1)
        require(re.fullmatch('[A-Z_][A-Z0-9_]*',key) and key not in values,'Nama konfigurasi tidak sah/duplikat.')
        values[key]=value
    require(values.get('NODE_ENV')=='production' and values.get('HOST')=='127.0.0.1' and values.get('PORT')=='4000'
            and len(values.get('JWT_SECRET','').strip())>=32,'Konfigurasi produksi belum sesuai.')
    return values


def check_saved_list(entries,release):
    require(isinstance(entries,list) and len(entries)==1,'Saved list PM2 harus tepat satu aplikasi.')
    entry=entries[0]
    require(entry['name']==APP and entry['exec_mode']=='fork_mode' and entry.get('instances',1)==1 and entry.get('status','online')=='online'
            and Path(entry['pm_cwd']).resolve(strict=True)==release/'backend'
            and Path(entry['pm_exec_path']).resolve(strict=True)==release/'backend/src/server.js','Saved list PM2 berbeda dari rilis aktif.')


def verify_release(release,commit,app):
    require(not release.is_symlink() and release.parent.resolve(strict=True)==(BASE/'releases').resolve(strict=True),'Path rilis berbeda.')
    manifest_path=release/'DEPLOYMENT.json';info=manifest_path.stat()
    require(not manifest_path.is_symlink() and info.st_uid==0 and not info.st_mode&0o022,'Izin manifest berbeda.')
    manifest=json.loads(manifest_path.read_text())
    require(manifest['commit']==commit and manifest['status']=='copied_not_activated','Manifest rilis belum sesuai.')
    needed={'backend/src/server.js','backend/src/db/database.js','backend/package.json','backend/package-lock.json','frontend/dist/index.html','.node-version'}
    require(needed.issubset(manifest['files']),'Manifest tidak lengkap.')
    for name,expected in manifest['files'].items():
        relative=Path(name);require(not relative.is_absolute() and '..' not in relative.parts,'Path manifest tidak sah.')
        path=release/relative
        require(path.resolve(strict=True).is_relative_to(release),'File keluar dari rilis.')
        if 'symlink' in expected:require(path.is_symlink() and os.readlink(path)==expected['symlink'],'Symlink rilis berubah.')
        else:
            require(not path.is_symlink() and digest(path)==expected['sha256'],'Checksum kode rilis berubah.')
            info=path.stat();require(info.st_uid==0 and info.st_gid==app.pw_gid and not info.st_mode&0o022,'Izin kode rilis berubah.')
    proof=release/'LPAPP-CHECK.json';info=proof.stat()
    require(not proof.is_symlink() and info.st_uid==0 and not info.st_mode&0o022,'Izin bukti lpapp berbeda.')
    tested=json.loads(proof.read_text())
    require(tested['status']=='lpapp_release_check_passed' and tested['commit']==commit and tested['cold_starts']==2
            and tested['candidate_unchanged'] is True and tested['temporary_processes_stopped'] is True
            and tested['temporary_data_removed'] is True and tested['live_database_modified'] is False,'Uji lpapp belum lengkap.')
    return tested


class Runtime:
    def __init__(self):
        self.base=BASE;self.db=BASE/'shared/data/enterprise.sqlite';self.app=pwd.getpwnam('lpapp')
        self.pm2=shutil.which('pm2',path='/usr/local/bin:/usr/bin:/bin')
        require(self.pm2 is not None,'PM2 tidak ditemukan.')
        info=ENV.stat()
        require(not ENV.is_symlink() and info.st_uid==0 and info.st_gid==self.app.pw_gid and info.st_mode&0o777==0o640,'Izin runtime.env berbeda.')
        self.env={**parse_env(ENV.read_text()),'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':self.app.pw_dir,
                  'USER':'lpapp','LOGNAME':'lpapp','PM2_HOME':str(Path(self.app.pw_dir)/'.pm2')}
        # Never allow Node preloads from the operator/old process environment.
        require(not {'NODE_OPTIONS','NODE_PATH','BASH_ENV','ENV','LD_PRELOAD','LD_LIBRARY_PATH'}&set(self.env),'Konfigurasi proses membutuhkan review.')
        self.dump=Path(self.app.pw_dir)/'.pm2/dump.pm2'
        daemon=Path(self.app.pw_dir)/'.pm2/pm2.pid'
        require(daemon.is_file() and Path('/proc',daemon.read_text().strip()).exists(),'Daemon PM2 belum aktif.')
        proc=Path('/proc',daemon.read_text().strip())
        require(proc.stat().st_uid==self.app.pw_uid and b'PM2' in (proc/'cmdline').read_bytes(),'Identitas daemon PM2 berbeda.')

    def command(self,args,*,as_app=False,check=True,timeout=180):
        identity={'user':self.app.pw_uid,'group':self.app.pw_gid,'extra_groups':[]} if as_app else {}
        result=subprocess.run(list(map(str,args)),cwd=self.app.pw_dir if as_app else '/',
            env=self.env if as_app else {'PATH':'/usr/sbin:/usr/bin:/sbin:/bin'},
            stdin=subprocess.DEVNULL,capture_output=True,text=True,timeout=timeout,**identity)
        if check:require(result.returncode==0,'Operasi sistem gagal; detail disimpan lokal, secret tidak ditampilkan.')
        return result

    def active(self):
        # Raw PM2 JSON contains secrets. It stays in memory and is never printed.
        entries=json.loads(self.command([self.pm2,'jlist'],as_app=True).stdout)
        require(len(entries)==1 and entries[0]['name']==APP,'Harus ada tepat satu aplikasi PM2.')
        entry=entries[0];config=entry['pm2_env'];pid=entry['pid']
        require(config['status']=='online' and config['exec_mode']=='fork_mode' and config.get('instances',1)==1,'PM2 harus satu fork online.')
        proc=Path('/proc',str(pid));cwd=(proc/'cwd').resolve(strict=True)
        require(proc.stat().st_uid==self.app.pw_uid and cwd==(BASE/'current').resolve(strict=True)/'backend','Proses/current berbeda.')
        require((cwd/'data/enterprise.sqlite').resolve(strict=True)==self.db.resolve(strict=True),'Database proses berbeda.')
        return cwd.parent

    def saved(self,release):
        require(not self.dump.is_symlink(),'Saved list PM2 berupa symlink.')
        check_saved_list(json.loads(self.dump.read_text()),release)

    def facts(self,path):
        result=self.command(['/usr/bin/python3','-I',Path(__file__).resolve(),'_facts-worker',path],as_app=True)
        return json.loads(result.stdout)

    def snapshot(self,source,target):
        parent=BASE/'backup-staging';require(not parent.is_symlink(),'Folder staging berupa symlink.')
        parent.mkdir(mode=0o710,exist_ok=True);os.chown(parent,0,self.app.pw_gid);os.chmod(parent,0o710)
        work=Path(tempfile.mkdtemp(dir=parent));os.chown(work,self.app.pw_uid,self.app.pw_gid)
        copy=work/'database.sqlite'
        try:
            result=json.loads(self.command(['/usr/bin/python3','-I',OPS/'server_backup.py','--worker',source,copy],as_app=True,timeout=330).stdout)
            result.update(self.facts(copy));info=copy.lstat()
            require(info.st_uid==self.app.pw_uid and info.st_nlink==1 and not copy.is_symlink() and digest(copy)==result['sha256'],'Snapshot tidak cocok.')
        finally:os.chown(work,0,0);os.chmod(work,0o700)
        os.chown(copy,0,0);os.chmod(copy,0o600);move(work,target)
        result.update(created_at=datetime.now(timezone.utc).isoformat(),backup=str(target/'database.sqlite'))
        atomic(target/'backup.json',result)
        return result

    def inspect_copy(self,source):
        # An offline candidate may be in the private operator home. The worker
        # receives a physical copy; it never needs access to that home/passwords.
        parent=BASE/'backup-staging';require(not parent.is_symlink(),'Folder staging berupa symlink.')
        parent.mkdir(mode=0o710,exist_ok=True);os.chown(parent,0,self.app.pw_gid);os.chmod(parent,0o710)
        with tempfile.TemporaryDirectory(dir=parent) as directory:
            work=Path(directory);os.chown(work,self.app.pw_uid,self.app.pw_gid)
            copy=work/'database.sqlite';shutil.copyfile(source,copy);os.chmod(copy,0o600);os.chown(copy,self.app.pw_uid,self.app.pw_gid)
            require(digest(copy)==digest(source),'Salinan kandidat berbeda.')
            return self.facts(copy)

    def doctor(self,allowed):
        result=self.command(['/usr/bin/python3','-I',OPS/'server_doctor.py'],check=False)
        data=json.loads(result.stdout)
        failed={entry['check'] for entry in data['checks'] if not entry['ok']}
        require(failed.issubset(allowed),'Pemeriksaan server lain belum lulus; jalankan doctor untuk detail.')

    def nginx(self,text):
        atomic(CONF,text.encode(),0o644)
        self.command(['/usr/sbin/nginx','-t']);self.command(['/usr/bin/systemctl','reload','nginx'])

    def public_status(self,status):
        connection=http.client.HTTPSConnection(IP,timeout=15,context=ssl.create_default_context())
        try:
            connection.request('GET','/');reply=connection.getresponse();reply.read()
            require(reply.status==status,'Status HTTPS publik berbeda.')
        finally:connection.close()

    def stop(self):
        self.command([self.pm2,'delete',APP],as_app=True,check=False)
        for _ in range(20):
            result=self.command(['ss','-lntp','sport = :4000'])
            if len(result.stdout.splitlines())<=1:break
            time.sleep(0.25)
        else:raise RuntimeError('Port4000 masih digunakan; data tidak diganti.')

    def data_closed(self):
        paths={str(self.db),str(self.db)+'-wal',str(self.db)+'-shm'}
        for directory in Path('/proc').glob('[0-9]*/fd'):
            try:
                for fd in directory.iterdir():
                    try:require(os.readlink(fd).removesuffix(' (deleted)') not in paths,'Database masih dibuka proses lain.')
                    except FileNotFoundError:pass
            except (FileNotFoundError,PermissionError):pass

    def point(self,release):
        next_link=BASE/('current.next-'+uuid.uuid4().hex);next_link.symlink_to(release)
        try:
            os.replace(next_link,BASE/'current');sync_dir(BASE)
        finally:next_link.unlink(missing_ok=True)

    def start(self,release,folder):
        control=BASE/'control';control.mkdir(mode=0o750,exist_ok=True)
        require(not control.is_symlink(),'Folder control berupa symlink.')
        os.chown(control,0,self.app.pw_gid);os.chmod(control,0o750)
        config=control/('production-'+folder.name+'.json')
        atomic(config,{'apps':[{'name':APP,'script':str(release/'backend/src/server.js'),'cwd':str(release/'backend'),
            'interpreter':'/usr/bin/node','instances':1,'exec_mode':'fork','watch':False,'autorestart':True,
            'max_memory_restart':'500M','env':{key:value for key,value in self.env.items() if key not in ('HOME','USER','LOGNAME','PM2_HOME','PATH')}}]},0o640,0,self.app.pw_gid)
        self.command([self.pm2,'start',config],as_app=True)

    def resurrect(self,folder):
        atomic(self.dump,(folder/'pm2-before.private.json').read_bytes(),0o600,self.app.pw_uid,self.app.pw_gid)
        self.command([self.pm2,'resurrect'],as_app=True)

    def healthy(self,release):
        expected=(release/'frontend/dist/index.html').read_bytes()
        for _ in range(30):
            try:
                conn=http.client.HTTPConnection('127.0.0.1',4000,timeout=2)
                try:
                    conn.request('GET','/');reply=conn.getresponse();html=reply.read()
                    require(reply.status==200 and html==expected,'HTML belum sesuai.')
                    conn.request('GET','/api/users');reply=conn.getresponse();reply.read();require(reply.status==401,'API anonim belum ditolak.')
                finally:conn.close()
                require(self.active()==release,'Rilis proses belum sesuai.')
                return
            except (OSError,RuntimeError,ValueError,http.client.HTTPException):time.sleep(0.5)
        raise RuntimeError('Aplikasi belum sehat setelah pergantian.')

    def persist(self,release):
        self.command([self.pm2,'save'],as_app=True);self.saved(release)

    def publish_backup(self,metadata):atomic(BASE/'backups/latest-verified.json',metadata)


@contextmanager
def locks():
    handles=[]
    try:
        for name in ('.deploy.lock','.ops.lock'):
            handle=(BASE/name).open('a');handles.append(handle);fcntl.flock(handle,fcntl.LOCK_EX|fcntl.LOCK_NB)
        yield
    finally:
        for handle in reversed(handles):handle.close()


def prepare(rt,release,candidate,reviewed_sha):
    require(not release.is_symlink() and not candidate.is_symlink(),'Rilis/kandidat harus direktori biasa.')
    release=release.resolve(strict=True);candidate=candidate.resolve(strict=True)
    original_plan=json.loads((candidate/'plan.json').read_text());body=dict(original_plan);provided=body.pop('plan_sha256')
    require(provided==reviewed_sha==hash_value(body),'Checksum plan yang disetujui berbeda.')
    result=json.loads((candidate/'result.json').read_text());commit=json.loads((release/'DEPLOYMENT.json').read_text())['commit']
    require(result['plan_sha256']==reviewed_sha and result['status']=='candidate_prepared','Kandidat/plan tidak cocok.')
    database=candidate/'production.sqlite'
    require(not candidate.is_symlink() and not database.is_symlink() and not candidate.resolve(strict=True).is_relative_to(BASE),'Path kandidat tidak sesuai.')
    proof=verify_release(release,commit,rt.app)
    require(proof['candidate_sha256']==result['candidate_sha256']==digest(database),'Kandidat berubah setelah uji lpapp.')
    require(not os.path.lexists(release/'backend/data'),'Link data rilis sudah ada.')
    old=rt.active();require(old!=release and (BASE/'current').is_symlink(),'Current harus rilis lama.')
    require(not rt.db.parent.is_symlink() and not rt.db.is_symlink() and rt.db.parent.resolve()==BASE/'shared/data','Folder data live tidak sesuai.')
    rt.saved(old);rt.doctor({'production_database_and_credentials'})
    require(rt.command(['/usr/bin/node','--version'],as_app=True).stdout.strip()=='v'+(release/'.node-version').read_text().strip(),'Node runtime berbeda.')
    original=CONF.read_bytes();maintenance_text(original.decode())
    require(shutil.disk_usage(BASE).free>=3*data_size(rt.db)+2*1024**3,'Ruang persiapan kurang.')
    parent=BASE/'backups';parent.mkdir(mode=0o700,exist_ok=True)
    require(not parent.is_symlink() and parent.stat().st_uid==os.geteuid() and not parent.stat().st_mode&0o077,'Izin folder backup perlu diperiksa.')
    folder=parent/('production-cutover-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ-')+uuid.uuid4().hex[:8]);folder.mkdir(mode=0o700)
    require(rt.db.parent.stat().st_dev==folder.stat().st_dev,'Data/arsip harus pada filesystem yang sama.')
    atomic(folder/'nginx-before.conf',original);atomic(folder/'runtime-before.private.env',ENV.read_bytes())
    atomic(folder/'pm2-before.private.json',rt.dump.read_bytes())
    source=rt.snapshot(rt.db,folder/'preparation-snapshot')
    require(source['production_format'] is None and source['bsi_schema_version']==2,'Alat ini hanya untuk cutover UAT BSI v2 pertama, bukan reset produksi.')
    if source['fingerprint']!=original_plan['source_fingerprint']:
        atomic(folder/'status.json',{'status':'source_changed_since_review','counts':source['counts']})
        raise RuntimeError('Data live berubah sejak rencana awal. Aplikasi tidak diubah; snapshot untuk review: '+str(folder))
    prepared=folder/'candidate-data';prepared.mkdir(mode=0o700)
    shutil.copyfile(database,prepared/'enterprise.sqlite');os.chmod(prepared/'enterprise.sqlite',0o600)
    with (prepared/'enterprise.sqlite').open('rb') as stream:os.fsync(stream.fileno())
    sync_dir(prepared)
    candidate_facts=rt.inspect_copy(prepared/'enterprise.sqlite')
    require(digest(database)==result['candidate_sha256']==digest(prepared/'enterprise.sqlite'),'Kandidat berubah saat persiapan.')
    require(candidate_facts['fingerprint']==result['candidate_fingerprint'],'Fingerprint kandidat berbeda.')
    require(candidate_facts['parameters_hash']==source['parameters_hash'] and candidate_facts['migration_history_hash']==source['migration_history_hash'],'Master bank berubah.')
    require(candidate_facts['production_format']=='lp-production-20261109-v1' and candidate_facts['active_accounts']==result['active_accounts']
            and candidate_facts['active_superadmins']>0 and candidate_facts['active_weak_hashes']==0,'Akun produksi belum sesuai.')
    require(all(candidate_facts['counts'][key]==0 for key in COLLECTIONS if key not in ('users','audit_logs')) and candidate_facts['counts']['files']==0,'Kandidat belum kosong.')
    plan={'format':1,'commit':commit,'old_release':str(old),'new_release':str(release),'reviewed_plan_sha256':reviewed_sha,
          'source_fingerprint':source['fingerprint'],'source_counts':source['counts'],'candidate_sha256':result['candidate_sha256'],
          'candidate_facts':candidate_facts,'env_sha256':digest(ENV),'nginx_sha256':digest(CONF),'dump_sha256':digest(rt.dump),
          'manifest_sha256':digest(release/'DEPLOYMENT.json'),'lpapp_check_sha256':digest(release/'LPAPP-CHECK.json'),
          'controller_sha256':digest(Path(__file__).resolve()),
          'backup_tool_sha256':digest(OPS/'server_backup.py'),'doctor_tool_sha256':digest(OPS/'server_doctor.py')}
    plan['plan_sha256']=hash_value(plan);atomic(folder/'plan.json',plan);atomic(folder/'status.json',{'status':'prepared'})
    return {'status':'cutover_prepared','plan':str(folder/'plan.json'),'plan_sha256':plan['plan_sha256'],'commit':commit,
            'active_accounts':candidate_facts['active_accounts'],'source_counts':source['counts'],'target_counts':candidate_facts['counts'],
            'pm2_saved_single_fork':True,'live_release_changed':False,'live_database_modified':False,'maintenance_started':False}


def read_plan(path,provided):
    require(not path.is_symlink() and not path.parent.is_symlink() and path.name=='plan.json'
            and path.parent.resolve(strict=True).parent==(BASE/'backups').resolve(strict=True),'Path plan berbeda.')
    info=path.stat();require(info.st_uid==os.geteuid() and info.st_mode&0o777==0o600,'Izin plan berbeda.')
    info=path.parent.stat();require(info.st_uid==os.geteuid() and info.st_mode&0o777==0o700,'Izin folder plan berbeda.')
    plan=json.loads(path.read_text());body=dict(plan);expected=body.pop('plan_sha256')
    require(expected==provided==hash_value(body),'Checksum rencana aktivasi berbeda.')
    return plan


def apply_transaction(rt,plan,folder):
    """Before opening traffic, restore the whole old pair on failure.

    Once opening has been attempted, retain the newest data and maintenance;
    an old snapshot is never restored automatically after possible user input.
    """
    old=Path(plan['old_release']);new=Path(plan['new_release']);data=rt.db.parent
    original=(folder/'nginx-before.conf').read_bytes();maintenance=maintenance_text(original.decode())
    closing_input=False;opening=False;before=None
    def state(status,**fields):atomic(folder/'status.json',{'status':status,'commit':plan['commit'],**fields})
    try:
        state('closing_input');closing_input=True;rt.nginx(maintenance);rt.public_status(503)
        state('stopping_old_process');rt.stop()
        before=rt.snapshot(rt.db,folder/'final-uat-snapshot')
        require(before['fingerprint']==plan['source_fingerprint'],'Data berubah sebelum proses berhenti; pergantian dibatalkan.')
        rt.data_closed()
        state('archiving_old_data');move(data,folder/'old-data')
        prepared=folder/'candidate-data'
        os.chown(prepared,rt.app.pw_uid,rt.app.pw_gid);os.chown(prepared/'enterprise.sqlite',rt.app.pw_uid,rt.app.pw_gid)
        with (prepared/'enterprise.sqlite').open('rb') as stream:os.fsync(stream.fileno())
        sync_dir(prepared)
        state('installing_new_data');move(prepared,data)
        (new/'backend/data').symlink_to(data);sync_dir(new/'backend')
        state('starting_new_release');rt.point(new);rt.start(new,folder);rt.healthy(new)
        require(rt.facts(rt.db)['fingerprint']==plan['candidate_facts']['fingerprint'],'Data produksi berubah sebelum pembukaan.')
        rt.persist(new)
        initial=rt.snapshot(rt.db,folder/'production-initial-snapshot');rt.publish_backup(initial)
        rt.doctor({'public_https_trust_and_page'})
        state('opening_public');opening=True;rt.nginx(original.decode());rt.public_status(200)
        state('active')
        return {'status':'production_active','commit':plan['commit'],'release':str(new),'backup':initial['backup'],
                'active_accounts':plan['candidate_facts']['active_accounts'],'counts':initial['counts']}
    except BaseException:
        if not closing_input:raise
        if opening:
            closed=False
            try:rt.nginx(maintenance);rt.public_status(503);closed=True
            except BaseException:pass
            state('needs_manual_recovery_after_opening',public_maintenance_confirmed=closed)
            raise RuntimeError('Akses mungkin sudah terbuka. Data terbaru dipertahankan; periksa status maintenance. Jangan restore snapshot lama. Arsip: '+str(folder)) from None
        try:
            if closing_input:
                rt.nginx(maintenance);rt.public_status(503);rt.stop()
                if (folder/'old-data').exists():
                    rt.data_closed()
                    if data.exists():move(data,folder/'failed-new-data')
                    move(folder/'old-data',data)
                link=new/'backend/data'
                if link.is_symlink() and link.resolve()==data:link.unlink();sync_dir(new/'backend')
                rt.point(old);rt.resurrect(folder);rt.healthy(old);rt.persist(old)
                if before is not None:rt.publish_backup(before)
                rt.nginx(original.decode());rt.public_status(200)
            state('old_pair_restored')
        except BaseException:
            closed=False
            try:rt.nginx(maintenance);rt.public_status(503);closed=True
            except BaseException:pass
            state('needs_manual_recovery_before_opening',public_maintenance_confirmed=closed)
            raise RuntimeError('Pemulihan perlu pemeriksaan; periksa status maintenance, pasangan kode/data dan arsip: '+str(folder)) from None
        raise RuntimeError('Pergantian dibatalkan; pasangan kode/data lama dipulihkan. Arsip: '+str(folder)) from None


def apply(rt,path,provided):
    plan=read_plan(path,provided);folder=path.parent
    require(json.loads((folder/'status.json').read_text())['status']=='prepared','Plan ini sudah dipakai; jangan ulangi aktivasi.')
    new=Path(plan['new_release']);old=Path(plan['old_release'])
    require(rt.active()==old,'Rilis aktif berubah sejak persiapan.')
    require(shutil.disk_usage(BASE).free>=2*data_size(rt.db)+2*1024**3,'Ruang aktivasi kurang; belum ada perubahan.')
    rt.saved(old);rt.doctor({'production_database_and_credentials'})
    require(digest(Path(__file__).resolve())==plan['controller_sha256'] and digest(OPS/'server_backup.py')==plan['backup_tool_sha256']
            and digest(OPS/'server_doctor.py')==plan['doctor_tool_sha256'],'Alat operasi berubah sejak persiapan.')
    require(rt.command(['/usr/bin/node','--version'],as_app=True).stdout.strip()=='v'+(new/'.node-version').read_text().strip(),'Node runtime berbeda.')
    verify_release(new,plan['commit'],rt.app)
    require(digest(new/'DEPLOYMENT.json')==plan['manifest_sha256'] and digest(new/'LPAPP-CHECK.json')==plan['lpapp_check_sha256'],'Bukti rilis berubah.')
    require(digest(CONF)==plan['nginx_sha256'] and digest(ENV)==plan['env_sha256'] and digest(rt.dump)==plan['dump_sha256'],'Konfigurasi berubah sejak persiapan.')
    require(digest(folder/'nginx-before.conf')==plan['nginx_sha256'] and digest(folder/'runtime-before.private.env')==plan['env_sha256']
            and digest(folder/'pm2-before.private.json')==plan['dump_sha256'],'Salinan konfigurasi pemulihan berubah.')
    require(digest(folder/'candidate-data/enterprise.sqlite')==plan['candidate_sha256'] and not os.path.lexists(new/'backend/data'),'Data rilis berbeda.')
    require(not rt.db.parent.is_symlink() and not rt.db.is_symlink() and rt.db.parent.resolve()==BASE/'shared/data','Folder data live berubah.')
    require(rt.facts(rt.db)['fingerprint']==plan['source_fingerprint'],'Data live berubah; belum ada maintenance/pergantian.')
    return apply_transaction(rt,plan,folder)


def main():
    os.umask(0o077)
    if len(sys.argv)==3 and sys.argv[1]=='_facts-worker':
        print(json.dumps(facts_worker(Path(sys.argv[2]))));return
    parser=argparse.ArgumentParser(description=__doc__);commands=parser.add_subparsers(dest='action',required=True)
    command=commands.add_parser('prepare');command.add_argument('--release',type=Path,required=True)
    command.add_argument('--candidate',type=Path,required=True);command.add_argument('--reviewed-plan-sha256',required=True)
    command=commands.add_parser('apply');command.add_argument('--plan',type=Path,required=True)
    command.add_argument('--plan-sha256',required=True);command.add_argument('--confirm-clean-reviewed-uat',action='store_true',required=True)
    args=parser.parse_args();require(os.geteuid()==0,'Jalankan alat terpasang dengan sudo.')
    require(not Path(__file__).is_symlink() and Path(__file__).stat().st_uid==0 and not Path(__file__).stat().st_mode&0o022,'Alat operasi harus root-owned.')
    with locks():
        rt=Runtime()
        result=prepare(rt,args.release,args.candidate,args.reviewed_plan_sha256) if args.action=='prepare' else apply(rt,args.plan,args.plan_sha256)
    print('RENCANA AKTIVASI SIAP' if args.action=='prepare' else 'AKTIVASI PRODUKSI BERHASIL')
    print(json.dumps(result,indent=2))


if __name__=='__main__':
    def interrupted(*args):raise KeyboardInterrupt
    signal.signal(signal.SIGTERM,interrupted);signal.signal(signal.SIGHUP,interrupted)
    try:main()
    except (Exception,KeyboardInterrupt) as error:
        print('BERHENTI: '+(str(error) if isinstance(error,RuntimeError) else type(error).__name__))
        raise SystemExit(1)
