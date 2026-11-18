"""Public DATA staging controls, without extracting or executing any package."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from .fixtures import Fixture
from . import DataRefused, source_members


class SourceZipTests(unittest.TestCase):
    def test_bounded_named_bodies_keep_exact_bytes_and_do_not_execute_or_extract_a_package(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            f = Fixture(root)
            f.write()
            expected = {'filename': 'agentfootprint-15.0.0-rc.0.tgz', 'size': f.path.stat().st_size,
                        'sha256': hashlib.sha256(f.path.read_bytes()).hexdigest()}
            result = source_members(f.path, expected)
            self.assertEqual(result[expected['filename']], f.tgz)
            self.assertEqual(set(p.name for p in root.iterdir()), {'input.zip'})
            script = Path(__file__).resolve().parents[1] / 'native_source_zip.py'
            out = root / 'named-data'
            run = lambda command: subprocess.run([sys.executable, '-B', str(script), command,
                                                  str(f.path), json.dumps(expected), str(out)],
                                                 text=True, capture_output=True, timeout=5)
            self.assertEqual(run('stage').returncode, 0)
            self.assertEqual(len(list(out.iterdir())), 4)
            self.assertEqual(run('verify').returncode, 0)
            (out / 'source-package.json').write_text('{"changed":true}')
            refused = run('verify')
            self.assertEqual(refused.returncode, 2)
            self.assertEqual(json.loads(refused.stdout)['status'], 'REFUSED')
            self.assertNotIn('Traceback', refused.stderr)
            self.assertFalse((root / 'PACKAGE-EXECUTED').exists())
            self.assertFalse((root / 'node_modules').exists())

    def test_wrong_outer_identity_size_or_traversal_name_refuses_before_named_data(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            f = Fixture(root)
            f.write()
            expected = {'filename': 'agentfootprint-15.0.0-rc.0.tgz', 'size': f.path.stat().st_size,
                        'sha256': hashlib.sha256(f.path.read_bytes()).hexdigest()}
            for key, value in [('filename', '../outside.tgz'), ('size', expected['size'] + 1),
                               ('sha256', '0' * 64)]:
                with self.subTest(key=key), self.assertRaises(DataRefused):
                    source_members(f.path, {**expected, key: value})
            self.assertEqual(set(p.name for p in root.iterdir()), {'input.zip'})
