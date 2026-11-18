"""Stage or re-check exactly four original named ZIP bodies as inert data."""
import os
from pathlib import Path
import sys
from native_inputs import DataRefused, parse_data, source_members, compatibility_members


def main(args):
    if len(args) != 4 or args[0] not in {'stage', 'verify'}:
        raise DataRefused('source-zip-arguments')
    command, source, encoded, directory = args
    if len(encoded) > 64 * 1024:
        raise DataRefused('source-zip-expectation')
    expected = parse_data(encoded.encode('utf-8', 'strict'))
    out = Path(directory)
    if not out.is_absolute() or out.parent.resolve() != out.parent:
        raise DataRefused('source-zip-output')
    members = compatibility_members(source, expected) if expected.get('format') == 'lens-compatibility-v1' else source_members(source, expected)
    if command == 'stage':
        out.mkdir(mode=0o700)  # Never overwrite a consumed stage.
        for name, data in members.items():
            fd = os.open(out / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
            with os.fdopen(fd, 'wb') as target:
                target.write(data)
    else:
        if out.resolve() != out or set(p.name for p in out.iterdir()) != set(members):
            raise DataRefused('source-zip-output')
        for name, data in members.items():
            fd = os.open(out / name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
            with os.fdopen(fd, 'rb') as current:
                import stat
                info = os.fstat(current.fileno())
                if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or current.read(len(data) + 1) != data:
                    raise DataRefused('source-zip-checkpoint')
    print('{"status":"DATA_ONLY","packageExecutionAllowed":false}')


if __name__ == '__main__':
    try:
        main(sys.argv[1:])
    except (DataRefused, OSError, ValueError, KeyError, TypeError):
        print('{"status":"REFUSED","reason":"source-zip-data"}')
        raise SystemExit(2)
