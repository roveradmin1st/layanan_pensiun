#!/usr/bin/env python3
"""Root scheduler; SQLite backup is delegated to lpapp and sealed after exit."""
from contextlib import closing
from datetime import datetime, timedelta, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import pwd
import re
import shutil
import sqlite3
import stat
import subprocess
import sys
import tempfile
import uuid

BASE = Path('/srv/layanan-pensiunan')
SOURCE = BASE/'shared/data/enterprise.sqlite'
WIB = timezone(timedelta(hours=7))
SCHEDULED_RE = re.compile(r'^scheduled-(\d{8}T\d{6}Z)-[0-9a-fA-F]+$')


def sha(path):
    with path.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()


def worker(source,target):
    if os.geteuid()==0:raise RuntimeError('SQLite worker must run as lpapp, not root.')
    source=source.resolve(strict=True)
    fd=os.open(target,os.O_CREAT|os.O_EXCL|os.O_WRONLY|os.O_NOFOLLOW,0o600);os.close(fd)
    with closing(sqlite3.connect(source.as_uri()+'?mode=ro',uri=True,timeout=30)) as origin, closing(sqlite3.connect(target,timeout=30,isolation_level=None)) as copy:
        origin.backup(copy,pages=256,sleep=0.05)
        copy.execute('PRAGMA journal_mode=DELETE')
        copy.execute('VACUUM')
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


def prune_scheduled_backups(base=BASE,now=None):
    backups=base/'backups'
    if not backups.is_dir() or backups.is_symlink():
        return {'pruned_count':0,'pruned':[],'kept_count':0}
    backups_resolved=backups.resolve()
    latest_marker=backups/'latest-verified.json'
    if not latest_marker.is_file() or latest_marker.is_symlink():
        return {'pruned_count':0,'pruned':[],'kept_count':0}
    try:
        latest_meta=json.loads(latest_marker.read_text())
    except (OSError,ValueError,TypeError):
        return {'pruned_count':0,'pruned':[],'kept_count':0}
    latest_backup_str=latest_meta.get('backup') if isinstance(latest_meta,dict) else None
    if not isinstance(latest_backup_str,str) or not latest_backup_str.strip():
        return {'pruned_count':0,'pruned':[],'kept_count':0}

    protected_dirs=set()
    latest_parent=Path(latest_backup_str).parent
    protected_dirs.add(latest_parent)
    if latest_parent.exists():
        protected_dirs.add(latest_parent.resolve())

    receipts_dir=base/'releases/receipts'
    if receipts_dir.is_dir() and not receipts_dir.is_symlink():
        for receipt_file in receipts_dir.glob('*.json'):
            if receipt_file.is_symlink() or not receipt_file.is_file():
                continue
            try:
                receipt_data=json.loads(receipt_file.read_text())
            except (OSError,ValueError,TypeError):
                return {'pruned_count':0,'pruned':[],'kept_count':0}
            if isinstance(receipt_data,dict):
                backup_ref=receipt_data.get('backup_ref')
                if isinstance(backup_ref,str) and backup_ref.strip():
                    ref_parent=Path(backup_ref).parent
                    protected_dirs.add(ref_parent)
                    if ref_parent.exists():
                        protected_dirs.add(ref_parent.resolve())

    candidates=[]
    for entry in backups.iterdir():
        if entry.is_symlink() or not entry.is_dir():
            continue
        match=SCHEDULED_RE.match(entry.name)
        if not match:
            continue
        meta_file=entry/'backup.json'
        db_file=entry/'database.sqlite'
        if meta_file.is_symlink() or db_file.is_symlink() or not meta_file.is_file() or not db_file.is_file():
            protected_dirs.add(entry)
            continue
        ts=None
        try:
            meta=json.loads(meta_file.read_text())
            created_at=meta.get('created_at') if isinstance(meta,dict) else None
            if isinstance(created_at,str) and created_at.strip():
                parsed=datetime.fromisoformat(created_at)
                if parsed.tzinfo is None:
                    parsed=parsed.replace(tzinfo=timezone.utc)
                ts=parsed.astimezone(timezone.utc)
        except (OSError,ValueError,TypeError):
            ts=None
        if ts is None:
            ts=datetime.strptime(match.group(1),'%Y%m%dT%H%M%SZ').replace(tzinfo=timezone.utc)
        candidates.append((ts,entry.name,entry))

    candidates.sort(key=lambda item:(item[0],item[1]),reverse=True)
    keep_names={name for _,name,_ in candidates[:48]}

    ref_wib_date=(now or datetime.now(timezone.utc)).astimezone(WIB).date()
    seen_wib_days=set()
    for ts,name,_ in candidates:
        wib_date=ts.astimezone(WIB).date()
        delta_days=(ref_wib_date-wib_date).days
        if 0<=delta_days<14 and wib_date not in seen_wib_days:
            seen_wib_days.add(wib_date)
            keep_names.add(name)

    for _,name,entry in candidates:
        if entry in protected_dirs or entry.resolve() in protected_dirs:
            keep_names.add(name)

    pruned=[]
    for _,name,entry in candidates:
        if name in keep_names:
            continue
        if entry.is_symlink() or not SCHEDULED_RE.match(entry.name) or entry.resolve().parent!=backups_resolved:
            continue
        shutil.rmtree(entry)
        pruned.append(name)

    return {'pruned_count':len(pruned),'pruned':pruned,'kept_count':len(keep_names)}


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
    retention=prune_scheduled_backups(BASE,now=now)
    print(json.dumps({'status':'backup_verified','backup':metadata['backup'],'sha256':metadata['sha256'],'counts':metadata['counts'],'pruned_count':retention['pruned_count']}))


if __name__=='__main__':
    try:main()
    except Exception as error:
        print('Backup stopped: '+str(error),file=sys.stderr);raise SystemExit(1)
