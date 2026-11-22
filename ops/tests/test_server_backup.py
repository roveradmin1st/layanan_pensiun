from datetime import datetime, timedelta, timezone
import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('server_backup', Path(__file__).parents[1]/'server_backup.py')
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class BackupTests(unittest.TestCase):
    def test_backup_includes_committed_wal_and_exact_document_bytes(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root/'source.sqlite'
            origin = sqlite3.connect(source)
            try:
                origin.execute('PRAGMA journal_mode=WAL')
                origin.execute('PRAGMA wal_autocheckpoint=0')
                origin.executescript('CREATE TABLE kv_store(collection TEXT PRIMARY KEY,payload TEXT); CREATE TABLE uploaded_files(id TEXT PRIMARY KEY,data BLOB);')
                state = {key:[] for key in ('users','leads','lead_requests','applications','simulations','claims')}
                state['leads'] = [{'id':'lead-committed-in-wal'}]
                origin.execute('INSERT INTO kv_store VALUES (?,?)', ('enterprise_state',json.dumps(state)))
                document = b'%PDF-1.4\x00private-fixture\xff'
                origin.execute('INSERT INTO uploaded_files VALUES (?,?)', ('file-wal',document));origin.commit()
                self.assertGreater(Path(str(source)+'-wal').stat().st_size,0)
                target = root/'backup.sqlite'
                with patch.object(backup.os,'geteuid',return_value=1000):
                    result = backup.worker(source,target)
                self.assertEqual(result['integrity'],'ok')
                self.assertEqual(result['sha256'],backup.sha(target))
                self.assertEqual(result['counts']['leads'],1)
                self.assertEqual(result['counts']['files'],1)
                self.assertEqual(target.stat().st_mode&0o777,0o600)
                restored = sqlite3.connect(target)
                try:
                    self.assertEqual(restored.execute('SELECT data FROM uploaded_files').fetchone()[0],document)
                    self.assertEqual(json.loads(restored.execute('SELECT payload FROM kv_store').fetchone()[0]),state)
                    self.assertEqual(restored.execute('PRAGMA integrity_check').fetchone()[0],'ok')
                finally:restored.close()
                self.assertEqual(origin.execute('SELECT COUNT(*) FROM uploaded_files').fetchone()[0],1)
            finally:origin.close()

    def test_worker_refuses_root_overwrite_symlinks_and_corrupt_sources(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory);source = root/'source.sqlite';source.write_bytes(b'corrupt SQLite')
            with patch.object(backup.os,'geteuid',return_value=0),self.assertRaisesRegex(RuntimeError,'not root'):
                backup.worker(source,root/'out.sqlite')
            protected = root/'existing';protected.write_bytes(b'preserve')
            linked = root/'linked';linked.symlink_to(protected)
            with patch.object(backup.os,'geteuid',return_value=1000):
                for target in (protected,linked):
                    with self.assertRaises(OSError):backup.worker(source,target)
                with self.assertRaises(sqlite3.DatabaseError):backup.worker(source,root/'bad-backup.sqlite')
            self.assertEqual(protected.read_bytes(),b'preserve')

    def test_atomic_marker_permissions_and_json(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'latest.json'
            backup.atomic_json(path,{'integrity':'ok','counts':{'files':2}})
            self.assertEqual(path.stat().st_mode&0o777,0o600)
            backup.atomic_json(path,{'integrity':'ok','counts':{'files':3}})
            self.assertEqual(json.loads(path.read_text())['counts']['files'],3)
            self.assertEqual(len(list(path.parent.iterdir())),1)

    def test_worker_vacuums_freelist_pages(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root/'fragmented.sqlite'
            origin = sqlite3.connect(source)
            try:
                origin.execute('PRAGMA journal_mode=WAL')
                origin.executescript('CREATE TABLE kv_store(collection TEXT PRIMARY KEY,payload TEXT); CREATE TABLE uploaded_files(id TEXT PRIMARY KEY,data BLOB); CREATE TABLE junk(id INTEGER PRIMARY KEY,data BLOB);')
                state = {key:[] for key in ('users','leads','lead_requests','applications','simulations','claims')}
                origin.execute('INSERT INTO kv_store VALUES (?,?)', ('enterprise_state',json.dumps(state)))
                for idx in range(50):
                    origin.execute('INSERT INTO junk VALUES (?,?)', (idx, b'x'*4096))
                origin.commit()
                origin.execute('DROP TABLE junk')
                origin.commit()
                origin.execute('PRAGMA wal_checkpoint(TRUNCATE)')
                self.assertGreater(origin.execute('PRAGMA freelist_count').fetchone()[0], 0)
            finally:
                origin.close()

            target = root/'compacted.sqlite'
            with patch.object(backup.os,'geteuid',return_value=1000):
                result = backup.worker(source,target)
            self.assertEqual(result['integrity'],'ok')
            compacted = sqlite3.connect(target)
            try:
                self.assertEqual(compacted.execute('PRAGMA freelist_count').fetchone()[0], 0)
                self.assertEqual(compacted.execute('PRAGMA integrity_check').fetchone()[0],'ok')
            finally:
                compacted.close()

    def test_prune_scheduled_backups_retention_and_protections(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            backups = base/'backups'
            receipts = base/'releases/receipts'
            backups.mkdir(parents=True)
            receipts.mkdir(parents=True)

            # Non-scheduled folders/files must never be deleted
            manual_dir = backups/'pre-cutover-manual'
            manual_dir.mkdir()
            (manual_dir/'database.sqlite').write_bytes(b'keep-manual')
            extra_file = backups/'notes.txt'
            extra_file.write_text('keep')

            now = datetime(2026, 11, 22, 12, 0, 0, tzinfo=timezone.utc)
            created_folders = []

            def make_snapshot(ts, tag):
                name = f"scheduled-{ts.strftime('%Y%m%dT%H%M%SZ')}-{tag}"
                folder = backups/name
                folder.mkdir()
                (folder/'database.sqlite').write_bytes(b'sqlite-placeholder')
                (folder/'backup.json').write_text(json.dumps({
                    'created_at': ts.isoformat(),
                    'backup': str(folder/'database.sqlite'),
                    'integrity': 'ok'
                }))
                created_folders.append(name)
                return name, folder

            # 55 hourly snapshots across recent ~2.3 days (newest 48 should be kept; plus 1 per WIB day)
            for h in range(55):
                make_snapshot(now - timedelta(hours=h), f'{h:08x}')

            # Older snapshots within last 14 WIB days (days 3..13 ago, 2 snapshots per day: latest kept, earlier pruned)
            expected_daily_kept = set()
            expected_daily_pruned = set()
            for day_ago in range(4, 14):
                wib_day_late = (now - timedelta(days=day_ago)).replace(hour=15, minute=0, second=0)  # 22:00 WIB
                wib_day_early = (now - timedelta(days=day_ago)).replace(hour=2, minute=0, second=0)  # 09:00 WIB
                k_name, _ = make_snapshot(wib_day_late, f'd{day_ago:02d}a1')
                p_name, _ = make_snapshot(wib_day_early, f'd{day_ago:02d}a0')
                expected_daily_kept.add(k_name)
                expected_daily_pruned.add(p_name)

            # Snapshots older than 14 WIB days (day 20 ago) -> pruned unless protected
            old_pruned_name, _ = make_snapshot(now - timedelta(days=20), 'old00001')
            receipt_protected_name, receipt_protected_dir = make_snapshot(now - timedelta(days=25), 'rec00001')
            latest_protected_name, latest_protected_dir = make_snapshot(now - timedelta(days=30), 'lat00001')

            (backups/'latest-verified.json').write_text(json.dumps({
                'backup': str(latest_protected_dir/'database.sqlite'),
                'created_at': now.isoformat(),
                'integrity': 'ok'
            }))
            (receipts/'latest-receipt.json').write_text(json.dumps({
                'operation_id': 'op-1',
                'backup_ref': str(receipt_protected_dir/'database.sqlite')
            }))

            res = backup.prune_scheduled_backups(base, now=now)
            self.assertTrue(manual_dir.is_dir())
            self.assertTrue(extra_file.is_file())
            self.assertTrue((backups/receipt_protected_name).is_dir())
            self.assertTrue((backups/latest_protected_name).is_dir())
            self.assertFalse((backups/old_pruned_name).exists())
            for k_name in expected_daily_kept:
                self.assertTrue((backups/k_name).is_dir())
            for p_name in expected_daily_pruned:
                self.assertFalse((backups/p_name).exists())
            for newest_name in created_folders[:48]:
                self.assertTrue((backups/newest_name).is_dir())
            self.assertGreater(res['pruned_count'], 0)


if __name__=='__main__':unittest.main()
