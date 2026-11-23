#!/usr/bin/env python3
"""Check an inactive staged release on temporary data; never operate PM2/Nginx."""
from contextlib import closing
import argparse
import fcntl
import hashlib
import http.client
import json
import os
from pathlib import Path
import pwd
import re
import secrets
import shutil
import signal
import socket
import sqlite3
import subprocess
import tempfile
import time

BASE = Path('/srv/layanan-pensiunan')
NODE = '/usr/bin/node'


def require(value, message):
    if not value: raise RuntimeError(message)


def digest(path):
    with path.open('rb') as stream: return hashlib.file_digest(stream,'sha256').hexdigest()


def snapshot(path):
    with closing(sqlite3.connect(path.resolve(strict=True).as_uri()+'?mode=ro',uri=True)) as db:
        db.execute('BEGIN')
        require(db.execute('PRAGMA quick_check').fetchall()==[('ok',)],'SQLite tidak sehat.')
        state=json.loads(db.execute("SELECT payload FROM kv_store WHERE collection='enterprise_state'").fetchone()[0])
        require(db.execute('SELECT COUNT(*) FROM uploaded_files').fetchone()[0]==0,'Kandidat masih berisi dokumen.')
    return state


def request(port, route, body=None):
    conn=http.client.HTTPConnection('127.0.0.1',port,timeout=3)
    try:
        conn.request('POST' if body is not None else 'GET',route,body=body,headers={'Content-Type':'application/json'})
        reply=conn.getresponse();return reply.status,reply.read()
    finally: conn.close()


def start_and_check(release, work, app, node):
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':app.pw_dir,'TZ':'Asia/Jakarta',
         'NODE_ENV':'production','HOST':'127.0.0.1','PORT':str(port),'JWT_SECRET':secrets.token_hex(32)}
    identity={'user':app.pw_uid,'group':app.pw_gid,'extra_groups':[]} if os.geteuid()==0 else {}
    require(os.geteuid()==0 or os.geteuid()==app.pw_uid,'Identitas penguji berbeda.')
    with (work/'startup.log').open('w') as log:
        proc=subprocess.Popen(['nice','-n','10',node,'src/server.js'],cwd=release/'backend',
                              env=env,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,**identity)
        try:
            for _ in range(80):
                require(proc.poll() is None,'Startup lpapp gagal; rilis belum aktif.')
                try:
                    if request(port,'/api/auth/me')[0]==401: break
                except (OSError,http.client.HTTPException): pass
                time.sleep(0.25)
            else: raise RuntimeError('Startup lpapp melewati batas waktu.')
            require(Path('/proc',str(proc.pid)).stat().st_uid==app.pw_uid,'Owner proses uji berbeda.')
            status,html=request(port,'/')
            require(status==200 and html==(release/'frontend/dist/index.html').read_bytes(),'Halaman rilis tidak cocok.')
            require(request(port,'/api/users')[0]==401,'API anonim tidak ditolak.')
            require(request(port,'/api/auth/quick-role',b'{}')[0]==403,'Quick-role produksi belum tertutup.')
            result=subprocess.run(['ss','-lntp',f'sport = :{port}'],capture_output=True,text=True,check=True,
                                  env={'PATH':'/usr/bin:/bin'})
            addresses=[line.split()[3] for line in result.stdout.splitlines()[1:] if line.split()]
            require(addresses==[f'127.0.0.1:{port}'],'Port uji harus hanya loopback.')
        finally:
            if proc.poll() is None: proc.terminate()
            try: proc.wait(timeout=5)
            except subprocess.TimeoutExpired: proc.kill();proc.wait()


def check_release(release, candidate, commit, *, base=BASE, app=None, node=NODE):
    os.umask(0o077)
    app=app or pwd.getpwnam('lpapp')
    require(not release.is_symlink() and not candidate.is_symlink(),'Rilis/kandidat harus direktori biasa.')
    base=base.resolve(strict=True);release=release.resolve(strict=True);candidate=candidate.resolve(strict=True)
    require(re.fullmatch(r'[0-9a-f]{40}',commit),'Commit harus SHA lengkap.')
    require(not release.is_symlink() and release.parent.resolve(strict=True)==(base/'releases').resolve(strict=True),'Folder rilis di luar releases.')
    require(not candidate.resolve(strict=True).is_relative_to(base.resolve(strict=True)),'Kandidat harus salinan privat di luar instalasi live.')
    node_version='v'+(release/'.node-version').read_text().strip()
    with (base/'.deploy.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        original_current=(base/'current').resolve(strict=True)
        require(not release.is_symlink() and original_current!=release,'Rilis sudah aktif atau path berbeda.')
        manifest_path=release/'DEPLOYMENT.json'
        require(not manifest_path.is_symlink() and manifest_path.stat().st_uid==os.geteuid()
                and not manifest_path.stat().st_mode&0o022,'Izin manifest rilis berbeda.')
        manifest=json.loads(manifest_path.read_text())
        require(manifest['commit']==commit and manifest['status']=='copied_not_activated','Manifest rilis berbeda.')
        required={'backend/src/server.js','backend/package.json','backend/package-lock.json','frontend/dist/index.html','.node-version'}
        require(required.issubset(manifest['files']),'Manifest rilis tidak lengkap.')
        for name,item in manifest['files'].items():
            relative=Path(name)
            require(not relative.is_absolute() and '..' not in relative.parts,'Path manifest tidak sah.')
            path=release/relative
            if 'symlink' in item:
                require(path.is_symlink() and os.readlink(path)==item['symlink'] and path.resolve(strict=True).is_relative_to(release),'Symlink rilis berubah.')
            else:
                require(not path.is_symlink() and path.resolve(strict=True).is_relative_to(release)
                        and digest(path)==item['sha256'],'Checksum rilis berubah.')
                info=path.stat()
                require(info.st_uid==os.geteuid() and info.st_gid==app.pw_gid and not info.st_mode&0o022,'Izin kode rilis berbeda.')
        identity={'user':app.pw_uid,'group':app.pw_gid,'extra_groups':[]} if os.geteuid()==0 else {}
        require(os.geteuid()==0 or os.geteuid()==app.pw_uid,'Identitas penguji berbeda.')
        version=subprocess.check_output([node,'--version'],text=True,timeout=10,cwd=app.pw_dir,
                                        env={'PATH':'/usr/local/bin:/usr/bin:/bin','HOME':app.pw_dir},**identity).strip()
        require(version==node_version,'Versi Node berbeda.')
        database=candidate/'production.sqlite'
        require(not candidate.is_symlink() and not database.is_symlink(),'Kandidat harus file salinan biasa.')
        original_hash=digest(database)
        prepared=json.loads((candidate/'result.json').read_text())
        proof=json.loads((candidate.parent/'candidate-check.json').read_text())
        require(prepared['status']=='candidate_prepared' and proof['status']=='candidate_smoke_passed' and proof['code_commit']==commit,'Bukti kandidat berbeda.')
        require(prepared['live_database_modified'] is False and proof['live_database_modified'] is False
                and all(proof[key] is True for key in ('first_login_password_gate','bank_scope_preserved',
                         'original_candidate_unchanged','original_credentials_unchanged')),'Pemeriksaan kandidat belum lengkap.')
        require(original_hash==prepared['candidate_sha256']==proof['candidate_sha256'],'Checksum kandidat berbeda.')
        original=snapshot(database)
        expected_active=proof['active_logins_checked']
        require(expected_active>0 and expected_active==prepared['active_accounts']
                and sum(user.get('active',True) is not False for user in original['users'])==expected_active,'Jumlah akun aktif berbeda.')
        require(all(not original[key] for key in ('leads','lead_requests','applications','simulations','claims','imports','parameter_proposals')),'Kandidat belum kosong.')
        link=release/'backend/data'
        require(not os.path.lexists(link),'Link data rilis sudah ada; perlu pemeriksaan.')
        try:
            with tempfile.TemporaryDirectory(prefix='lp-release-check-',dir=app.pw_dir) as directory:
                work=Path(directory);os.chown(work,app.pw_uid,app.pw_gid)
                data=work/'data';data.mkdir(mode=0o700);os.chown(data,app.pw_uid,app.pw_gid)
                copy=data/'enterprise.sqlite';shutil.copyfile(database,copy)
                copy.chmod(0o600);os.chown(copy,app.pw_uid,app.pw_gid)
                link.symlink_to(data)
                try:
                    for _ in range(2): start_and_check(release,work,app,node)
                    require(snapshot(copy)==original,'Data berubah setelah dua startup uji.')
                finally:
                    require(link.is_symlink() and os.readlink(link)==str(data),'Link data uji berubah; periksa rilis.')
                    link.unlink()
        finally:
            require(digest(database)==original_hash,'Kandidat asli berubah; hentikan aktivasi.')
            require((base/'current').resolve(strict=True)==original_current,'Current berubah saat pengujian.')
        result={'status':'lpapp_release_check_passed','commit':commit,'node':node_version,
                'active_accounts':expected_active,'cold_starts':2,'runtime_user':'lpapp',
                'candidate_sha256':original_hash,'candidate_unchanged':True,'test_data_unchanged':True,
                'loopback_only':True,'temporary_processes_stopped':True,'temporary_data_removed':True,
                'live_release_changed':False,'live_database_modified':False,'release_data_link_present':link.is_symlink()}
        with tempfile.NamedTemporaryFile(mode='w',dir=release,delete=False) as out:
            temporary=Path(out.name);os.fchmod(out.fileno(),0o640);os.fchown(out.fileno(),os.geteuid(),app.pw_gid)
            json.dump(result,out,indent=2);out.write('\n');out.flush();os.fsync(out.fileno())
        os.replace(temporary,release/'LPAPP-CHECK.json')
        return result


if __name__=='__main__':
    def interrupted(*args): raise KeyboardInterrupt
    signal.signal(signal.SIGTERM,interrupted);signal.signal(signal.SIGHUP,interrupted)
    try:
        parser=argparse.ArgumentParser(description=__doc__)
        parser.add_argument('--release',type=Path,required=True)
        parser.add_argument('--candidate',type=Path,required=True)
        parser.add_argument('--commit',required=True)
        args=parser.parse_args()
        require(os.geteuid()==0,'Jalankan blok ini dengan sudo.')
        result=check_release(args.release,args.candidate,args.commit)
        print('UJI LPAPP BERHASIL');print(json.dumps(result,indent=2))
    except (Exception,KeyboardInterrupt) as error:
        print('Uji berhenti: '+(str(error) if isinstance(error,RuntimeError) else type(error).__name__))
        raise SystemExit(1)
