from datetime import datetime, timezone, timedelta
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


def module(name):
    spec=importlib.util.spec_from_file_location(name,Path(__file__).parents[1]/(name+'.py'))
    value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value


doctor=module('server_doctor');export=module('server_export')


class DoctorExportTests(unittest.TestCase):
    def test_runtime_parser_handles_quoted_values_without_expanding_shell(self):
        values=doctor.parse_env('NODE_ENV=production\nexport HOST=127.0.0.1\nJWT_SECRET="literal-$(not-executed)-#value"\nPORT=4000 # comment\n')
        self.assertEqual(values['JWT_SECRET'],'literal-$(not-executed)-#value')
        self.assertEqual(values['PORT'],'4000')
        with self.assertRaises(ValueError):doctor.parse_env('BAD=one two')

    def test_verified_backup_age_checksum_location_and_permissions(self):
        with tempfile.TemporaryDirectory() as directory:
            base=Path(directory);folder=base/'backups';folder.mkdir();source=folder/'database.sqlite';source.write_bytes(b'fixture ciphertext-independent')
            source.chmod(0o600)
            marker=folder/'latest-verified.json'
            now=datetime.now(timezone.utc)
            meta={'backup':str(source),'integrity':'ok','sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'created_at':now.isoformat()}
            def write():marker.write_text(json.dumps(meta))
            write()
            # The cloud tests run as an unprivileged operator. Mock ownership only, preserving real paths and modes.
            real_stat=Path.stat
            def root_owned(path,*args,**kwargs):
                value=real_stat(path,*args,**kwargs)
                if path==source:
                    import os
                    entries=list(value);entries[4]=0;return os.stat_result(entries)
                return value
            with patch.object(Path,'stat',root_owned):
                self.assertTrue(doctor.backup_health(marker,now)['valid'])
                self.assertEqual(export.latest_verified(base),source)
                meta['created_at']=(now-timedelta(hours=2)).isoformat();write()
                self.assertFalse(doctor.backup_health(marker,now)['valid'])
                with self.assertRaises(RuntimeError):export.latest_verified(base)
                meta['created_at']=now.isoformat();meta['sha256']='0'*64;write()
                self.assertFalse(doctor.backup_health(marker,now)['valid'])
                with self.assertRaises(RuntimeError):export.latest_verified(base)
                source.chmod(0o644)
                with self.assertRaises(ValueError):doctor.backup_health(marker,now)

    def test_encrypted_receiver_is_private_exclusive_and_rejects_traversal(self):
        with tempfile.TemporaryDirectory() as directory:
            folder=Path(directory)/'downloads';payload=b'encrypted-fixture-only'
            result=export.receive(folder,'fixture.sqlite.gpg',io.BytesIO(payload))
            self.assertEqual(result['sha256'],hashlib.sha256(payload).hexdigest())
            self.assertEqual((folder/'fixture.sqlite.gpg').stat().st_mode&0o777,0o600)
            self.assertEqual(folder.stat().st_mode&0o777,0o700)
            with self.assertRaises(FileExistsError):export.receive(folder,'fixture.sqlite.gpg',io.BytesIO(payload))
            with self.assertRaises(RuntimeError):export.receive(folder,'../escape.sqlite.gpg',io.BytesIO(payload))
            self.assertEqual(len(list(folder.iterdir())),1)


if __name__=='__main__':unittest.main()
