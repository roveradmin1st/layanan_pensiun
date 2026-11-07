import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import jwt from 'jsonwebtoken';
import { hashPassword, verifyPassword, legacyPasswordHash, passwordProblem, isStrongPasswordHash } from '../src/security/passwords.js';
import { LoginLimiter } from '../src/security/login-limiter.js';
import { disposableBackend, runFixture, startFixture } from './helpers/disposable.mjs';

const PASSWORD = 'Fixture-only-Password-2026!';
const CHANGED = 'Changed-only-Password-2026!';
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
const readState = (fixture) => {
  const db = new DatabaseSync(fixture.database, { readOnly: true });
  try { return JSON.parse(db.prepare("SELECT payload FROM kv_store WHERE collection='enterprise_state'").get().payload); }
  finally { db.close(); }
};
const checkRun = (result) => assert.equal(result.status, 0, result.stderr);

test('Passwords use random salts, verify both formats and reject unsupported costs and oversized input', async () => {
  const first = await hashPassword(PASSWORD), second = await hashPassword(PASSWORD);
  assert.notEqual(first, second);
  assert.equal(isStrongPasswordHash(first), true);
  assert.deepEqual(await verifyPassword(PASSWORD, first), { valid: true, needsRehash: false });
  assert.equal((await verifyPassword('wrong', first)).valid, false);
  assert.deepEqual(await verifyPassword(PASSWORD, legacyPasswordHash(PASSWORD)), { valid: true, needsRehash: true });
  assert.equal((await verifyPassword(PASSWORD, first.replace('131072', '999999999'))).valid, false);
  assert.equal((await verifyPassword('é'.repeat(129), first)).valid, false);
  assert.ok(passwordProblem('short'));
  assert.ok(passwordProblem('Password123!'));
  assert.ok(passwordProblem('é'.repeat(129)));
  assert.equal(passwordProblem(PASSWORD), null);
});

test('Login limiter normalizes identifiers, expires limits, bounds memory and counts parallel reservations', () => {
  let now = 0;
  const limiter = new LoginLimiter({ accountLimit: 2, ipLimit: 3, windowMs: 1500, maxEntries: 2, clock: () => now });
  assert.equal(limiter.reserve('ip1', ' USER@example.test ').allowed, true);
  assert.equal(limiter.reserve('ip1', 'user@example.test').allowed, true);
  assert.deepEqual(limiter.reserve('ip1', 'USER@example.test'), { allowed: false, retryAfter: 2 });
  assert.equal(limiter.reserve('ip1', 'other@example.test').allowed, true);
  assert.equal(limiter.reserve('ip1', 'third@example.test').allowed, false);
  assert.equal(limiter.accounts.size, 2);
  now = 1500;
  assert.equal(limiter.reserve('ip1', 'user@example.test').allowed, true);
  assert.equal(limiter.accounts.size, 1);
  const attempts = Array.from({ length: 3 }, () => limiter.reserve('ip2', 'user@example.test').allowed);
  assert.deepEqual(attempts, [true, true, false]);
  assert.equal(limiter.ips.size, 2);
});

test('Production refuses missing, empty or corrupt state without replacing data or creating demo data', () => {
  const fixture = disposableBackend();
  try {
    const startup = () => runFixture(fixture, "import './src/db/database.js'", 'production');
    assert.notEqual(startup().status, 0);
    assert.equal(fs.existsSync(fixture.database), false);
    checkRun(runFixture(fixture, "import {getStore,db} from './src/db/database.js';getStore();db.close();"));
    for (const payload of ['{broken', '{}', null]) {
      const db = new DatabaseSync(fixture.database);
      if (payload === null) db.exec('DELETE FROM kv_store');
      else db.prepare("UPDATE kv_store SET payload=? WHERE collection='enterprise_state'").run(payload);
      db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); db.close();
      const before = fs.readFileSync(fixture.database);
      const result = startup();
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /PRODUCTION_DATABASE_INVALID/);
      assert.deepEqual(fs.readFileSync(fixture.database), before);
    }
  } finally { fixture.cleanup(); }
});

test('Production restart preserves empty business data, account scopes and custom bank parameters without seeding', () => {
  const fixture = disposableBackend();
  try {
    checkRun(runFixture(fixture, `import {getStore,saveStore,db} from './src/db/database.js';
const state=getStore();
for(const key of ['leads','lead_requests','applications','simulations','claims','imports','audit_logs','parameter_proposals']) state[key]=[];
state.partner_parameters.bsi_prapen.products.PP10.loan.maxPlafondAbsolute=234000000;
saveStore();db.close();`));
    const before = readState(fixture);
    for (let i = 0; i < 2; i++) checkRun(runFixture(fixture, "import {getStore,db} from './src/db/database.js';getStore();db.close();", 'production'));
    assert.deepEqual(readState(fixture), before);
  } finally { fixture.cleanup(); }
});

test('Production HTTP: password gate, session revocation, immutable document review and separate proof-backed payment', { timeout: 90000 }, async (t) => {
  const fixture = disposableBackend();
  let running;
  try {
    checkRun(runFixture(fixture, `import {getStore,saveStore,db,DOC_TEMPLATE} from './src/db/database.js';
import {hashPassword,legacyPasswordHash} from './src/security/passwords.js';
const state=getStore(), encoded=await hashPassword(${JSON.stringify(PASSWORD)});
const user=(id,role,extra={})=>({id,name:'Fixture '+id,email:id+'@example.test',role,branch:'BANDUNG',bank_scope:'all_bank',active:true,password_hash:encoded,auth_version:1,must_change_password:false,...extra});
state.users=[user('super','super_admin'),user('ops','admin_ops'),user('first','marketing',{must_change_password:true}),user('legacy','marketing',{password_hash:legacyPasswordHash('Legacy-unique-2026!')}),user('default','marketing',{password_hash:legacyPasswordHash('Password123!')})];
for(const key of ['leads','lead_requests','applications','simulations','claims','imports','audit_logs','parameter_proposals']) state[key]=[];
state.applications=[{id:'app-fixture',app_no:'APP-FIXTURE',lead_name:'Synthetic test',marketing_id:'first',marketing_name:'Fixture first',branch:'BANDUNG',bank_key:'ams2',stage:'upload_dokumen',rejected:false,history:[],checklist:DOC_TEMPLATE.map(d=>({...d,status:null,versions:0,filename:null}))}];
state.claims=[{id:'claim-fixture',claim_no:'CLM-FIXTURE',application_id:'app-fixture',marketing_id:'first',branch:'BANDUNG',bank_key:'ams2',amount:250000,status:'SUBMITTED',history:[]}];
saveStore();db.close();`));
    running = await startFixture(fixture, 'production');
    const call = async (method, route, body, token, extraHeaders = {}) => {
      const headers = { ...extraHeaders };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
      const response = await fetch(running.base + route, { method, headers, body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined });
      const data = response.headers.get('content-type')?.includes('json') ? await response.json() : Buffer.from(await response.arrayBuffer());
      return { status: response.status, headers: response.headers, data };
    };
    const login = async (id, password = PASSWORD) => {
      const result = await call('POST', '/api/auth/login', { email: id + '@example.test', password });
      assert.equal(result.status, 200, result.data.detail);
      assert.match(result.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Lax/);
      return result.data;
    };
    const superLogin = await login('super');
    const superToken = superLogin.access_token;
    const opsToken = (await login('ops')).access_token;
    await t.test('Anonymous, legacy tokens, default credentials, production restore and quick-role are blocked', async () => {
      assert.equal((await call('GET', '/api/users')).status, 401);
      const oldToken = jwt.sign({ sub: 'super' }, running.secret);
      assert.equal((await call('GET', '/api/auth/me', null, oldToken)).status, 401);
      assert.equal((await call('POST', '/api/auth/login', { email: 'default@example.test', password: 'Password123!' })).status, 403);
      assert.equal((await call('POST', '/api/auth/quick-role', { role: 'super_admin' }, superToken)).status, 403);
      assert.equal((await call('POST', '/api/backup/restore', null, superToken, { 'Content-Type': 'multipart/form-data; boundary=malformed' })).status, 403);
      const oversized = await call('POST', '/api/auth/login', { email: 'x'.repeat(9000), password: 'x' });
      assert.equal(oversized.status, 413);
      const count = readState(fixture).users.length;
      for (const override of [{ email: 'invalid-email' }, { name: '   ' }, { bank_scope: 'unknown' }]) {
        assert.equal((await call('POST', '/api/users', { name: 'Valid fixture', email: 'new@example.test', password: PASSWORD, ...override }, superToken)).status, 400);
      }
      assert.equal(readState(fixture).users.length, count);
    });
    let firstToken;
    await t.test('First-login gate allows password change; change/reset/logout revoke old tokens', async () => {
      const first = await login('first'); firstToken = first.access_token;
      assert.equal(first.user.must_change_password, true);
      assert.equal((await call('GET', '/api/auth/me', null, firstToken)).status, 200);
      const blocked = await call('GET', '/api/leads', null, firstToken);
      assert.equal(blocked.status, 403); assert.equal(blocked.data.error_code, 'PASSWORD_CHANGE_REQUIRED');
      assert.equal((await call('POST', '/api/auth/change-password', { current_password: PASSWORD, new_password: 'short' }, firstToken)).status, 400);
      const changed = await call('POST', '/api/auth/change-password', { current_password: PASSWORD, new_password: CHANGED }, firstToken);
      assert.equal(changed.status, 200);
      assert.equal((await call('GET', '/api/auth/me', null, firstToken)).status, 401);
      firstToken = changed.data.access_token;
      assert.equal((await call('GET', '/api/leads', null, firstToken)).status, 200);
      const reset = await call('PATCH', '/api/users/first', { password: PASSWORD }, superToken);
      assert.equal(reset.status, 200);
      assert.equal((await call('GET', '/api/auth/me', null, firstToken)).status, 401);
      firstToken = (await login('first')).access_token;
      const done = await call('POST', '/api/auth/change-password', { current_password: PASSWORD, new_password: CHANGED }, firstToken);
      assert.equal(done.status, 200); firstToken = done.data.access_token;
      const another = (await login('first', CHANGED)).access_token;
      assert.equal((await call('POST', '/api/auth/logout', null, another)).status, 200);
      assert.equal((await call('GET', '/api/auth/me', null, firstToken)).status, 401);
      firstToken = (await login('first', CHANGED)).access_token;
      assert.equal((await call('PATCH', '/api/users/super', { role: 'marketing' }, superToken)).status, 400);
      assert.equal((await call('PATCH', '/api/users/super', { active: false }, superToken)).status, 400);
    });
    await t.test('Successful legacy login upgrades the hash; role changes invalidate the session', async () => {
      const legacy = await login('legacy', 'Legacy-unique-2026!');
      assert.equal(isStrongPasswordHash(readState(fixture).users.find(u => u.id === 'legacy').password_hash), true);
      assert.equal((await call('PATCH', '/api/users/legacy', { role: 'sales_manager' }, superToken)).status, 200);
      assert.equal((await call('GET', '/api/auth/me', null, legacy.access_token)).status, 401);
    });
    await t.test('Missing original files cannot be accepted; replaced files require a new version/hash review', async () => {
      const route = '/api/applications/app-fixture/documents/ktp_pasangan';
      assert.equal((await call('GET', route, null, superToken)).status, 404);
      assert.equal((await call('POST', route + '/review', { status: 'diterima', expected_version: 1 }, opsToken)).status, 400);
      const upload = async (bytes) => { const form = new FormData(); form.append('file', new Blob([bytes], { type: 'application/pdf' }), 'fixture.pdf'); return call('POST', route, form, firstToken); };
      const v1 = await upload(PDF); assert.equal(v1.status, 200);
      const opened = await call('GET', route, null, opsToken);
      assert.deepEqual(opened.data, PDF); assert.equal(opened.headers.get('x-document-version'), '1');
      assert.equal((await call('POST', route + '/review', { status: 'diterima' }, opsToken)).status, 409);
      const review = { status: 'diterima', expected_version: v1.data.versions, expected_sha256: opened.headers.get('x-document-sha256') };
      assert.equal((await call('POST', route + '/review', review, opsToken)).status, 200);
      const updatedBytes = Buffer.concat([PDF, Buffer.from('\n% new version')]);
      const v2 = await upload(updatedBytes); assert.equal(v2.status, 200); assert.equal(v2.data.versions, 2);
      assert.equal(v2.data.status, 'diunggah'); assert.equal(v2.data.reviewed_version, undefined);
      assert.equal((await call('POST', route + '/review', review, opsToken)).status, 409);
      assert.equal((await call('POST', route + '/review', { ...review, expected_version: 2 }, opsToken)).status, 409);
      const latest = await call('GET', route, null, opsToken);
      assert.deepEqual(latest.data, updatedBytes);
      const accept = await call('POST', route + '/review', { status: 'diterima', expected_version: 2, expected_sha256: latest.headers.get('x-document-sha256') }, opsToken);
      assert.equal(accept.status, 200);
      assert.equal((await call('POST', '/api/applications/app-fixture/action', { action: 'forward' }, opsToken)).status, 400);
      assert.equal((await call('POST', route + '/review', { status: 'ditolak', expected_version: 2 }, opsToken)).status, 400);
      assert.equal((await call('POST', route + '/review', { status: 'ditolak', expected_version: 2, note: 'Tulisan tidak terbaca' }, opsToken)).status, 200);
      const db = new DatabaseSync(fixture.database, { readOnly: true });
      try {
        assert.deepEqual(Buffer.from(db.prepare('SELECT data FROM uploaded_files WHERE id=?').get(v1.data.file_id).data), PDF);
        assert.deepEqual(Buffer.from(db.prepare('SELECT data FROM uploaded_files WHERE id=?').get(v2.data.file_id).data), updatedBytes);
      } finally { db.close(); }
    });
    await t.test('Approval is not payment; proof and approved amount are mandatory, duplicate payment fails', async () => {
      const route = '/api/claims/claim-fixture';
      assert.equal((await call('POST', route + '/pay', null, opsToken)).status, 400);
      const approved = await call('POST', route + '/action', { action: 'approve' }, opsToken);
      assert.equal(approved.status, 200); assert.equal(approved.data.status, 'APPROVED');
      assert.equal(approved.data.paid_at, undefined); assert.ok(approved.data.approved_at);
      assert.equal((await call('POST', route + '/action', { action: 'approve' }, opsToken)).status, 409);
      assert.equal((await call('POST', route + '/pay', null, opsToken)).status, 400);
      const form = (amount, bytes = PDF) => { const data = new FormData(); data.append('file', new Blob([bytes], { type: 'application/pdf' }), 'proof.pdf'); data.append('amount', String(amount)); return data; };
      assert.equal((await call('POST', route + '/pay', form(1), opsToken)).status, 409);
      assert.equal((await call('POST', route + '/pay', form(250000, Buffer.from('not a PDF')), opsToken)).status, 400);
      const paid = await call('POST', route + '/pay', form(250000), opsToken);
      assert.equal(paid.status, 200); assert.equal(paid.data.status, 'PAID'); assert.ok(paid.data.paid_at);
      assert.equal((await call('POST', route + '/pay', form(250000), opsToken)).status, 409);
    });
    await t.test('Malformed multipart stays bounded and the server remains available; repeated login gets 429', async () => {
      const bad = await fetch(running.base + '/api/applications/app-fixture/documents/kk', { method: 'POST', headers: { Authorization: 'Bearer ' + superToken, 'Content-Type': 'multipart/form-data; boundary=test' }, body: '--test\r\nContent-Disposition: form-data; name="file"; filename="x.pdf"\r\n\r\nunfinished' });
      assert.equal(bad.status, 400);
      assert.equal((await call('GET', '/api/auth/me', null, superToken)).status, 200);
      for (let i = 0; i < 10; i++) assert.equal((await call('POST', '/api/auth/login', { email: 'limited@example.test', password: 'wrong' })).status, 401);
      const limited = await call('POST', '/api/auth/login', { email: ' LIMITED@example.test ', password: 'wrong' });
      assert.equal(limited.status, 429); assert.ok(Number(limited.headers.get('retry-after')) > 0);
    });
  } finally { if (running) await running.stop(); fixture.cleanup(); }
});
