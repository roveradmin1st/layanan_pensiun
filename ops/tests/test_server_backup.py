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


if __name__=='__main__':unittest.main()
