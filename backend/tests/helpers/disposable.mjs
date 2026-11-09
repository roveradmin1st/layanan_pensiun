import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';

const backend = fileURLToPath(new URL('../../', import.meta.url));

export function disposableBackend() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-readiness-'));
  const cwd = path.join(root, 'backend');
  fs.mkdirSync(cwd);
  fs.cpSync(path.join(backend, 'src'), path.join(cwd, 'src'), { recursive: true });
  fs.writeFileSync(path.join(cwd, 'package.json'), '{"type":"module"}');
  const linkType = process.platform === 'win32' ? 'junction' : 'dir';
  fs.symlinkSync(path.join(backend, 'node_modules'), path.join(cwd, 'node_modules'), linkType);
  fs.mkdirSync(path.join(root, 'frontend/dist'), { recursive: true });
  fs.writeFileSync(path.join(root, 'frontend/dist/index.html'), '<!doctype html><title>Disposable test</title>');
  return { root, cwd, database: path.join(cwd, 'data/enterprise.sqlite'),
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

export function runFixture(fixture, code, mode = 'development', input = '') {
  return spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: fixture.cwd, env: { ...process.env, NODE_ENV: mode }, input, encoding: 'utf8', timeout: 30000
  });
}

export async function startFixture(fixture, mode = 'development', secret = 'test-only-jwt-secret-83de9fb35526818f') {
  const probe = net.createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const proc = spawn(process.execPath, ['src/server.js'], {
    cwd: fixture.cwd, env: { ...process.env, NODE_ENV: mode, JWT_SECRET: secret, PORT: String(port), HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = '';
  proc.stdout.on('data', (data) => { log += data; }); proc.stderr.on('data', (data) => { log += data; });
  const stop = async () => {
    if (proc.exitCode === null && proc.signalCode === null) {
      const ended = new Promise((resolve) => proc.once('exit', resolve));
      proc.kill();
      const timeout = setTimeout(() => proc.kill('SIGKILL'), 5000);
      await ended; clearTimeout(timeout);
    }
  };
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Disposable server startup timed out')), 10000);
      proc.stdout.on('data', (chunk) => { if (String(chunk).toLowerCase().includes('running on')) { clearTimeout(timer); resolve(); } });
      proc.once('error', (error) => { clearTimeout(timer); reject(error); });
      proc.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Disposable server exited (${code}): ${log}`)); });
    });
    return { base: `http://127.0.0.1:${port}`, stop, proc, secret };
  } catch (error) { await stop(); throw error; }
}
