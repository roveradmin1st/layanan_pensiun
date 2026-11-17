#!/usr/bin/env python3
"""Root scheduler; SQLite backup is delegated to lpapp and sealed after exit."""
from contextlib import closing
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import pwd
import shutil
import sqlite3
import stat
import subprocess
import sys
import tempfile
import uuid

BASE = Path('/srv/layanan-pensiunan')
SOURCE = BASE/'shared/data/enterprise.sqlite'


def sha(path):
    with path.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()


def worker(source,target):
    if os.geteuid()==0:raise RuntimeError('SQLite worker must run as lpapp, not root.')
    source=source.resolve(strict=True)
    fd=os.open(target,os.O_CREAT|os.O_EXCL|os.O_WRONLY|os.O_NOFOLLOW,0o600);os.close(fd)
    with closing(sqlite3.connect(source.as_uri()+'?mode=ro',uri=True,timeout=30)) as origin, closing(sqlite3.connect(target,timeout=30)) as copy:
        origin.backup(copy,pages=256,sleep=0.05);copy.execute('PRAGMA journal_mode=DELETE')
        if copy.execute('PRAGMA integrity_check').fetchall()!=[('ok',)]:raise RuntimeError('Backup integrity failed.')
        state=json.loads(copy.execute("SELECT payload FROM kv_store WHERE collection='enterprise_state'").fetchone()[0])
        counts={key:len(state[key]) for key in ('users','leads','lead_requests','applications','simulations','claims')}
        counts['files']=copy.execute('SELECT COUNT(*) FROM uploaded_files').fetchone()[0]
    with target.open('rb') as stream:os.fsync(stream.fileno())
    return {'integrity':'ok','sha256':sha(target),'bytes':target.stat().st_size,'counts':counts}


def atomic_json(path,value):
    fd,name=tempfile.mkstemp(dir=path.parent)
    try:
        with os.fdopen(fd,'w') as stream:
            os.fchmod(stream.fileno(),0o600);json.dump(value,stream,indent=2);stream.write('\n');stream.flush();os.fsync(stream.fileno())
        os.replace(name,path)
    finally:Path(name).unlink(missing_ok=True)


def main():
    os.umask(0o077)
    if len(sys.argv)==4 and sys.argv[1]=='--worker':
        print(json.dumps(worker(Path(sys.argv[2]),Path(sys.argv[3]))));return
    if len(sys.argv)!=1 or os.geteuid()!=0:raise RuntimeError('Run installed scheduler with sudo and no arguments.')
    locks=[]
    for name in ('.deploy.lock','.ops.lock'):
        lock=(BASE/name).open('a')
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:
            print(json.dumps({'status':'skipped_deployment_in_progress'}));return
        locks.append(lock)
    app=pwd.getpwnam('lpapp')
    estimate=SOURCE.stat().st_size
    wal=Path(str(SOURCE)+'-wal')
    if wal.exists():estimate+=wal.stat().st_size
    if shutil.disk_usage(BASE).free<2*estimate+2*1024**3:raise RuntimeError('Insufficient backup space; inspect disk and verified retention/offsite copies.')
    parent=BASE/'backup-staging';backups=BASE/'backups'
    for folder,mode,gid in ((parent,0o710,app.pw_gid),(backups,0o700,0)):
        if folder.is_symlink():raise RuntimeError('Backup directory cannot be a symlink.')
        folder.mkdir(mode=mode,exist_ok=True);os.chown(folder,0,gid);os.chmod(folder,mode)
    work=Path(tempfile.mkdtemp(dir=parent));os.chown(work,app.pw_uid,app.pw_gid)
    try:
        result=subprocess.run(['/usr/bin/sudo','-u','lpapp','-H','--','/usr/bin/python3','-I',str(Path(__file__).resolve()),'--worker',str(SOURCE),str(work/'database.sqlite')],
            cwd='/',capture_output=True,text=True,timeout=300)
    finally:
        os.chown(work,0,0);os.chmod(work,0o700)
    if result.returncode:raise RuntimeError('SQLite worker failed; live database was not modified.')
    metadata=json.loads(result.stdout)
    target=work/'database.sqlite';info=target.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid!=app.pw_uid or info.st_nlink!=1 or sha(target)!=metadata['sha256']:
        raise RuntimeError('Backup checksum/attributes failed.')
    os.chown(target,0,0);os.chmod(target,0o600)
    now=datetime.now(timezone.utc)
    folder=backups/('scheduled-'+now.strftime('%Y%m%dT%H%M%SZ-')+uuid.uuid4().hex[:8])
    os.rename(work,folder)
    metadata.update(created_at=now.isoformat(),backup=str(folder/'database.sqlite'))
    atomic_json(folder/'backup.json',metadata);atomic_json(backups/'latest-verified.json',metadata)
    print(json.dumps({'status':'backup_verified','backup':metadata['backup'],'sha256':metadata['sha256'],'counts':metadata['counts']}))


if __name__=='__main__':
    try:main()
    except Exception as error:
        print('Backup stopped: '+str(error),file=sys.stderr);raise SystemExit(1)
