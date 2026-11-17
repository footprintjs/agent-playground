"""Print data observations or a fixed refusal; there are no effectful commands."""
import json
import sys

from .inspect import inspect_artifact
from .receipt import DataRefused, parse_json, require
from .zip_data import read_regular


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    try:
        require(len(args) == 2, 'arguments')
        expected = parse_json(read_regular(args[1], 64 * 1024))
        result = inspect_artifact(args[0], expected)
    except DataRefused as error:
        print(json.dumps({'status': 'REFUSED', 'activationAllowed': False,
                          'packageExecutionAllowed': False, 'reason': error.reason}))
        return 2
    print(json.dumps(result, sort_keys=True))
    return 0
