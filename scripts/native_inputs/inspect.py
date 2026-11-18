"""Data identity observation only; no downloader, installer or activation API."""
from .receipt import FILENAME, census_digest, parse_json, validate_expected, validate_receipt
from .tar_data import validate_tar
from .zip_data import MAX_ZIP, read_regular, read_zip


def inspect_artifact(path, expected):
    expected = validate_expected(expected)
    files = read_zip(read_regular(path, MAX_ZIP), expected['outerSha256'])
    record = validate_receipt(parse_json(files['candidate.json']), expected, files)
    census = validate_tar(files[FILENAME], record['archive']['files'], files['source-package.json'])
    archive = {key: value for key, value in record['archive'].items() if key != 'files'}
    archive.update(census)
    archive['memberCensusSha256'] = census_digest(record['archive']['files'])
    return {'status': 'DATA_ONLY', 'activationAllowed': False, 'packageExecutionAllowed': False,
            'outerSha256': expected['outerSha256'], 'source': dict(record['source']),
            'tested': dict(record['tested']), 'archive': archive}
