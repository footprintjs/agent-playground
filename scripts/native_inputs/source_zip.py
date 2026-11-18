"""Named source-ZIP DATA bodies only; never extract a tar or import its contents."""
import re

from .receipt import require, shape
from .zip_data import MAX_ZIP, read_regular, read_zip


def source_members(path, expected):
    shape(expected, {'filename', 'size', 'sha256'}, 'source-zip-expectation')
    name = expected['filename']
    require(type(name) is str and re.fullmatch(
        r'(agentfootprint|agentfootprint-lens)-[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?\.tgz', name),
        'source-zip-name')
    require(type(expected['size']) is int and 0 < expected['size'] <= MAX_ZIP, 'source-zip-size')
    require(type(expected['sha256']) is str and re.fullmatch('[a-f0-9]{64}', expected['sha256']),
            'source-zip-digest')
    raw = read_regular(path, MAX_ZIP)
    require(len(raw) == expected['size'], 'source-zip-size')
    limits = {name: 32 * 1024 * 1024, 'candidate.json': 8 * 1024 * 1024,
              'source-package.json': 1024 * 1024, 'source-package-lock.json': 8 * 1024 * 1024}
    return read_zip(raw, expected['sha256'], limits=limits)
