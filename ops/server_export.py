#!/usr/bin/env python3
"""Encrypt the latest verified backup; export only ciphertext to the SSH operator."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import pwd
import shutil
import stat
import subprocess
import sys
import tempfile
import uuid

BASE=Path('/srv/layanan-pensiunan')


def digest(path):
    with path.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()


def latest_verified(base):
    metadata=json.loads((base/'backups/latest-verified.json').read_text())
    source=Path(metadata['backup'])
    if source.is_symlink() or not source.resolve(strict=True).is_relative_to((base/'backups').resolve()):raise RuntimeError('Backup location is invalid.')
    info=source.stat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid!=0 or info.st_mode&0o077:raise RuntimeError('Backup permissions are invalid.')
    age=(datetime.now(timezone.utc)-datetime.fromisoformat(metadata['created_at'])).total_seconds()
    if metadata.get('integrity')!='ok' or digest(source)!=metadata['sha256'] or not 0<=age<=90*60:raise RuntimeError('Create a fresh verified backup before export.')
    return source


def receive(folder,name,stream):
    if os.geteuid()==0:raise RuntimeError('Export receiver cannot run as root.')
    if Path(name).name!=name or not name.endswith('.sqlite.gpg'):raise RuntimeError('Invalid export filename.')
    if folder.is_symlink():raise RuntimeError('Download directory cannot be a symlink.')
    folder.mkdir(mode=0o700,exist_ok=True)
    if folder.stat().st_uid!=os.geteuid():raise RuntimeError('Download directory owner does not match operator.')
    os.chmod(folder,0o700)
    target=folder/name
    fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    with os.fdopen(fd,'wb') as output:
        shutil.copyfileobj(stream,output);output.flush();os.fsync(output.fileno())
    return {'encrypted_file':str(target),'sha256':digest(target),'bytes':target.stat().st_size}


def main():
    os.umask(0o077)
    if len(sys.argv)==3 and sys.argv[1]=='--receive':
        folder=Path(pwd.getpwuid(os.geteuid()).pw_dir)/'lp-backup-downloads'
        print(json.dumps(receive(folder,sys.argv[2],sys.stdin.buffer)));return
    if len(sys.argv)!=1 or os.geteuid()!=0:raise RuntimeError('Run the installed export with sudo and no arguments in an interactive SSH terminal.')
    operator=pwd.getpwnam(os.environ.get('SUDO_USER',''))
    if operator.pw_uid<1000 or not Path(operator.pw_dir).is_relative_to('/home'):raise RuntimeError('Run sudo from the regular SSH operator account.')
    source=latest_verified(BASE)
    parent=BASE/'backup-exports'
    if parent.is_symlink():raise RuntimeError('Export staging cannot be a symlink.')
    parent.mkdir(mode=0o700,exist_ok=True);os.chown(parent,0,0);os.chmod(parent,0o700)
    name='layanan-pensiunan-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ-')+uuid.uuid4().hex[:8]+'.sqlite.gpg'
    with tempfile.TemporaryDirectory(dir=parent) as directory:
        stage=Path(directory);encrypted=stage/name;keyhome=stage/'gnupg';keyhome.mkdir(mode=0o700)
        print('Buat passphrase backup yang panjang dan simpan terpisah dari file. GPG akan meminta dua kali; ketikan tidak ditampilkan.',flush=True)
        try:
            subprocess.run(['/usr/bin/gpg','--homedir',str(keyhome),'--no-symkey-cache','--pinentry-mode','loopback','--symmetric','--cipher-algo','AES256','--output',str(encrypted),str(source)],check=True)
        finally:
            subprocess.run(['/usr/bin/gpgconf','--homedir',str(keyhome),'--kill','all'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        expected=digest(encrypted)
        with encrypted.open('rb') as stream:
            completed=subprocess.run(['/usr/bin/sudo','-u',operator.pw_name,'-H','--','/usr/bin/python3','-I',str(Path(__file__).resolve()),'--receive',name],
                                     stdin=stream,cwd='/',capture_output=True,text=True,check=True,timeout=300)
        result=json.loads(completed.stdout)
        if result['sha256']!=expected:raise RuntimeError('Encrypted export checksum mismatch.')
        print(json.dumps({'status':'encrypted_export_ready','download_and_verify_on_laptop':True,'database_sha256':digest(source),**result},indent=2))


if __name__=='__main__':
    try:main()
    except Exception:
        print('Export stopped; no plaintext backup was exported. Inspect locally and rerun after correction.',file=sys.stderr);raise SystemExit(1)
