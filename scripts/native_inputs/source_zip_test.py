"""Public DATA staging controls, without extracting or executing any package."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile
import stat

from .fixtures import Fixture
from . import DataRefused, source_members, compatibility_members


class SourceZipTests(unittest.TestCase):
    def test_actual_nine_body_lens_shape_is_data_only_and_rejects_wrong_members_or_types(self):
        names = ['agentfootprint-15.0.0-rc.0.tgz', 'agentfootprint-lens-0.83.0.tgz',
                 'contextfootprint-0.1.1.tgz', 'agent-source.json', 'contract.json',
                 'footprint-explainable-ui-1.1.1.tgz', 'footprintjs-14.0.0-rc.0.tgz',
                 'foottrace-2.1.0.tgz', 'input.json']
        bodies = {name: ('inert ' + name).encode() for name in names}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            path = root / 'original.zip'
            def write(entries):
                with zipfile.ZipFile(path, 'w') as archive:
                    for name, data in entries:
                        archive.writestr(name, data)
                return {'format': 'lens-compatibility-v1', 'size': path.stat().st_size,
                        'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                        'files': {name: {'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
                                  for name, data in bodies.items()}}
            expected = write(list(bodies.items()))
            self.assertEqual(compatibility_members(path, expected), bodies)
            # Rebind the outer digest so these controls reach the real inventory/type/body boundary.
            for entries in [list(bodies.items())[:-1], list(bodies.items()) + [('outside', b'inert')],
                            [(name, b'changed' if name == 'input.json' else data) for name, data in bodies.items()]]:
                with self.subTest(kind='inventory-or-body'), self.assertRaises(DataRefused):
                    compatibility_members(path, write(entries))
            link = zipfile.ZipInfo('input.json')
            link.create_system = 3
            link.external_attr = (stat.S_IFLNK | 0o777) << 16
            with self.assertRaises(DataRefused):
                compatibility_members(path, write([(link if name == 'input.json' else name, data)
                                                    for name, data in bodies.items()]))
            self.assertEqual(set(p.name for p in root.iterdir()), {'original.zip'})

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
