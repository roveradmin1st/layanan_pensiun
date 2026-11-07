#!/usr/bin/env python3
"""One reproducible validation command; all backend databases are disposable."""
from __future__ import annotations

import argparse
from contextlib import contextmanager
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from urllib.request import Request, urlopen
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parent.parent


def run(args, cwd, env=None):
    subprocess.run(args, cwd=cwd, env=env, check=True)


def request(base, route, body=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token: headers['Authorization'] = 'Bearer ' + token
    req = Request(base + route, data=json.dumps(body).encode() if body else None, headers=headers)
    try:
        with urlopen(req, timeout=5) as response:
            return response.status, response.headers, response.read()
    except HTTPError as error:
        try: return error.code, error.headers, error.read()
        finally: error.close()


@contextmanager
def server(root, mode, log):
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
    env = {**os.environ, 'NODE_ENV': mode, 'HOST': '127.0.0.1', 'PORT': str(port), 'JWT_SECRET': secrets.token_hex(32)}
    env.pop('API_BASE_URL', None)
    base = f'http://127.0.0.1:{port}'
    with log.open('w') as output:
        proc = subprocess.Popen(['node', 'src/server.js'], cwd=root / 'backend', env=env, stdout=output, stderr=subprocess.STDOUT)
        try:
            for _ in range(60):
                if proc.poll() is not None: raise RuntimeError('Disposable backend exited; inspect its log.')
                try:
                    if request(base, '/api/auth/me')[0] == 401: break
                except OSError: pass
                time.sleep(0.25)
            else: raise RuntimeError('Disposable backend did not become ready.')
            yield base
        finally:
            proc.terminate()
            try: proc.wait(timeout=5)
            except subprocess.TimeoutExpired: proc.kill(); proc.wait()


def production_smoke(base, password):
    checks = [('/', None, 200), ('/api/users', None, 401),
              ('/api/auth/quick-role', {'role': 'super_admin'}, 403)]
    for route, body, expected in checks:
        status = request(base, route, body)[0]
        if status != expected:
            raise RuntimeError(f'Production smoke failed: {route} HTTP{status}, expected{expected}.')
    status, headers, body = request(base, '/api/auth/login', {'email': 'superadmin@layananpensiunan.id', 'password': password})
    if status != 200 or 'Secure' not in headers.get('Set-Cookie', ''):
        raise RuntimeError('Production login / secure session smoke failed.')
    token = json.loads(body)['access_token']
    if request(base, '/api/auth/me', token=token)[0] != 200:
        raise RuntimeError('Production authenticated session smoke failed.')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--skip-install', action='store_true', help='Reuse already installed lockfile dependencies locally.')
    parser.add_argument('--browser', action='store_true', help='Run Playwright against a synthetic production fixture after the build.')
    parser.add_argument('--system-chromium', action='store_true', help='Use an already-installed /usr/bin/chromium for the browser check.')
    args = parser.parse_args()
    print('Runtime:', subprocess.check_output(['node', '--version'], text=True).strip(), flush=True)
    if not args.skip_install:
        run(['npm', 'ci', '--omit=dev'], ROOT / 'backend')
        run(['npm', 'ci', '--include=dev'], ROOT / 'frontend')
    run([sys.executable, '-m', 'unittest', 'discover', '-s', 'ops/tests', '-v'], ROOT)
    build_env = {**os.environ, 'VITE_BACKEND_URL': ''}
    run(['npm', 'run', 'build'], ROOT / 'frontend', build_env)
    with tempfile.TemporaryDirectory(prefix='lp-ci-') as directory:
        sandbox = Path(directory)
        shutil.copytree(ROOT / 'backend', sandbox / 'backend', ignore=shutil.ignore_patterns('node_modules', 'data', '.env*', '*.log'))
        (sandbox / 'backend/node_modules').symlink_to(ROOT / 'backend/node_modules', target_is_directory=True)
        shutil.copytree(ROOT / 'frontend/src', sandbox / 'frontend/src')
        (sandbox / 'frontend/dist').symlink_to(ROOT / 'frontend/dist', target_is_directory=True)
        # Even child-process production checks resolve into this disposable source copy.
        run(['npm', 'test'], sandbox / 'backend')
        with server(sandbox, 'development', sandbox / 'development.log') as base:
            env = {**os.environ, 'API_BASE_URL': base}
            run(['node', 'tests/security-and-api.test.mjs'], sandbox / 'backend', env)
        production_password = secrets.token_urlsafe(24)
        setup = """import fs from 'node:fs';
import {getStore,saveStore,db} from './src/db/database.js';
import {hashPassword} from './src/security/passwords.js';
const password=fs.readFileSync(0,'utf8'),store=getStore();
const user=store.users.find(u=>u.email==='superadmin@layananpensiunan.id');
user.password_hash=await hashPassword(password); user.auth_version=1; user.must_change_password=false;
saveStore();db.close();"""
        subprocess.run(['node','--input-type=module','-e',setup], cwd=sandbox / 'backend', input=production_password, text=True, check=True, capture_output=True)
        with server(sandbox, 'production', sandbox / 'production.log') as base:
            production_smoke(base, production_password)
        if args.browser:
            browser_args = ['node', 'ops/browser-smoke.mjs']
            if args.system_chromium: browser_args.append('--system-chromium')
            run(browser_args, ROOT)
        print('CI PASSED: backend tests, isolated security API, production smoke and frontend build.', flush=True)


if __name__ == '__main__': main()
