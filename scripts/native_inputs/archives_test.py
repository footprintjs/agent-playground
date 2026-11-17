import copy
import gzip
import stat
import tarfile
import tempfile
import unittest
import warnings
import zipfile
from pathlib import Path

from . import DataRefused, inspect_artifact
from .fixtures import Fixture, NAME, encoded


class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='app-native-archive-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.fixture = Fixture(self.root)
        self.expected = self.fixture.write()

    def test_zip_traversal_duplicates_and_nonregular_files_are_refused(self):
        normal = [(NAME, self.fixture.tgz), ('candidate.json', encoded(self.fixture.record)),
                  ('source-package.json', self.fixture.manifest),
                  ('source-package-lock.json', self.fixture.lock)]
        malicious = []
        for name in ['../candidate.json', '/candidate.json', 'a\\candidate.json']:
            malicious.append(normal[:1] + [(name, normal[1][1])] + normal[2:])
        malicious.append(normal + [normal[1]])
        link = zipfile.ZipInfo('candidate.json')
        link.create_system = 3
        link.external_attr = (stat.S_IFLNK | 0o777) << 16
        malicious.append(normal[:1] + [(link, b'../outside')] + normal[2:])
        for entries in malicious:
            with warnings.catch_warnings():
                warnings.simplefilter('ignore', UserWarning)
                expected = self.fixture.write(entries=entries)
            with self.subTest(entries=str(entries[1][0])), self.assertRaises(DataRefused):
                inspect_artifact(self.fixture.path, expected)

    def test_tar_traversal_links_duplicates_and_nonregular_members_are_refused(self):
        for name, content, kind in [('package/../outside', b'x', tarfile.REGTYPE),
                                     ('/outside', b'x', tarfile.REGTYPE),
                                     ('package/a\\b', b'x', tarfile.REGTYPE),
                                     ('package/link', b'', tarfile.SYMTYPE),
                                     ('package/hard', b'', tarfile.LNKTYPE),
                                     ('package/directory', b'', tarfile.DIRTYPE),
                                     ('package/dist/index.cjs', b'extra', tarfile.REGTYPE)]:
            item = Fixture(self.root, [(name, content, kind)])
            expected = item.write()
            with self.subTest(name=name, kind=kind), self.assertRaises(DataRefused):
                inspect_artifact(item.path, expected)

    def test_actual_member_content_must_match_even_a_consistent_receipt_census(self):
        self.fixture.record['archive']['files'][1]['sha256'] = '0' * 64
        expected = self.fixture.write()
        with self.assertRaisesRegex(DataRefused, 'tar-member'):
            inspect_artifact(self.fixture.path, expected)

    def test_missing_or_extra_receipt_members_are_refused(self):
        self.fixture.record['archive']['files'].pop()
        expected = self.fixture.write()
        with self.assertRaises(DataRefused):
            inspect_artifact(self.fixture.path, expected)

    def test_receipt_census_order_must_match_actual_tar_order(self):
        self.fixture.record['archive']['files'].reverse()
        expected = self.fixture.write()
        with self.assertRaisesRegex(DataRefused, 'tar-order'):
            inspect_artifact(self.fixture.path, expected)

    def test_duplicate_receipt_paths_are_refused(self):
        self.fixture.record['archive']['files'].append(
            copy.deepcopy(self.fixture.record['archive']['files'][0]))
        expected = self.fixture.write()
        with self.assertRaisesRegex(DataRefused, 'receipt-member'):
            inspect_artifact(self.fixture.path, expected)

    def test_gzip_trailing_or_second_member_is_refused_with_updated_outer_and_archive_pins(self):
        original = self.fixture.tgz
        for suffix in [b'hidden', gzip.compress(b'other', mtime=0)]:
            self.fixture.replace_tar(original + suffix)
            expected = self.fixture.write()
            with self.subTest(suffix=suffix[:6]), self.assertRaisesRegex(DataRefused, 'gzip-data'):
                inspect_artifact(self.fixture.path, expected)

    def test_nonzero_payload_after_tar_end_is_refused(self):
        raw = gzip.compress(gzip.decompress(self.fixture.tgz) + b'hidden', mtime=0)
        self.fixture.replace_tar(raw)
        expected = self.fixture.write()
        with self.assertRaisesRegex(DataRefused, 'tar-trailing'):
            inspect_artifact(self.fixture.path, expected)

    def test_case_or_file_directory_collisions_are_refused(self):
        for extra in [[('package/DIST/index.cjs', b'other', tarfile.REGTYPE)],
                      [('package/dist', b'other', tarfile.REGTYPE)]]:
            item = Fixture(self.root, extra)
            expected = item.write()
            with self.subTest(extra=extra[0][0]), self.assertRaises(DataRefused):
                inspect_artifact(item.path, expected)

    def test_more_than_ten_thousand_members_fit_the_actual_af_twenty_thousand_limit(self):
        extra = [(f'package/dist/unit{i}.js', b'', tarfile.REGTYPE) for i in range(9_999)]
        item = Fixture(self.root, extra)
        result = inspect_artifact(item.path, item.write())
        self.assertEqual(result['archive']['memberCount'], 10_001)

    def test_sparse_oversized_zip_input_is_refused_before_reading(self):
        path = self.root / 'oversized.zip'
        with path.open('wb') as handle:
            handle.truncate(64 * 1024 * 1024 + 1)
        with self.assertRaisesRegex(DataRefused, 'input-size'):
            inspect_artifact(path, self.expected)
