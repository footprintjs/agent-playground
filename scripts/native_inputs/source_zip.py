"""Named source-ZIP DATA bodies only; never extract a tar or import its contents."""
import re

from .receipt import FILENAME, digest, require, shape
from .zip_data import MAX_ZIP, read_regular, read_zip


def source_members(path, expected):
    shape(expected, {'filename', 'size', 'sha256'}, 'source-zip-expectation')
    name = expected['filename']
    require(name == FILENAME, 'source-zip-name')
    require(type(expected['size']) is int and 0 < expected['size'] <= MAX_ZIP, 'source-zip-size')
    require(type(expected['sha256']) is str and re.fullmatch('[a-f0-9]{64}', expected['sha256']),
            'source-zip-digest')
    raw = read_regular(path, MAX_ZIP)
    require(len(raw) == expected['size'], 'source-zip-size')
    limits = {name: 32 * 1024 * 1024, 'candidate.json': 8 * 1024 * 1024,
              'source-package.json': 1024 * 1024, 'source-package-lock.json': 8 * 1024 * 1024}
    return read_zip(raw, expected['sha256'], limits=limits)


def compatibility_members(path, expected):
    """The actual Lens nine-body compatibility wire format, not an AF source wrapper."""
    shape(expected, {'format', 'size', 'sha256', 'files'}, 'compatibility-zip-expectation')
    require(expected['format'] == 'lens-compatibility-v1', 'compatibility-zip-format')
    names = {'agentfootprint-15.0.0-rc.0.tgz', 'agentfootprint-lens-0.83.0.tgz',
             'contextfootprint-0.1.1.tgz', 'agent-source.json', 'contract.json',
             'footprint-explainable-ui-1.1.1.tgz', 'footprintjs-14.0.0-rc.0.tgz',
             'foottrace-2.1.0.tgz', 'input.json'}
    shape(expected['files'], names, 'compatibility-zip-members')
    require(type(expected['size']) is int and 0 < expected['size'] <= MAX_ZIP, 'compatibility-zip-size')
    require(type(expected['sha256']) is str and re.fullmatch('[a-f0-9]{64}', expected['sha256']),
            'compatibility-zip-digest')
    limits = {}
    for name, binding in expected['files'].items():
        shape(binding, {'size', 'sha256'}, 'compatibility-zip-binding')
        maximum = 32 * 1024 * 1024 if name.endswith('.tgz') else 8 * 1024 * 1024
        require(type(binding['size']) is int and 0 < binding['size'] <= maximum, 'compatibility-zip-size')
        require(type(binding['sha256']) is str and re.fullmatch('[a-f0-9]{64}', binding['sha256']),
                'compatibility-zip-digest')
        limits[name] = maximum
    raw = read_regular(path, MAX_ZIP)
    require(len(raw) == expected['size'], 'compatibility-zip-size')
    files = read_zip(raw, expected['sha256'], limits=limits)
    for name, data in files.items():
        require(len(data) == expected['files'][name]['size'] and
                digest(data) == expected['files'][name]['sha256'], 'compatibility-zip-body')
    return files
