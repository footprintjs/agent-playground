"""One fixed, provisional hosted data read; no install or producer activation."""
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from .inspect import inspect_artifact
from .receipt import DataRefused, parse_json, require, shape, validate_expected
from .zip_data import MAX_ZIP, read_regular

REPOSITORY = 'footprintjs/agentfootprint'
CONSUMER = 'footprintjs/agent-playground'
UPLOAD_STEP = 'Run actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9'


def _same(actual, expected, reason):
    require(type(actual) is type(expected) and actual == expected, reason)


def load_pins():
    pins = parse_json(read_regular(Path(__file__).with_name('provisional_af_d3.json'), 64 * 1024))
    shape(pins, {'repository', 'repositoryId', 'run', 'job', 'artifact', 'expected'}, 'probe-pins')
    require(pins['repository'] == REPOSITORY and type(pins['repositoryId']) is int,
            'probe-pins')
    shape(pins['run'], {'id', 'run_attempt', 'workflow_id', 'name', 'event',
                        'head_branch', 'conclusion'}, 'probe-pins')
    shape(pins['job'], {'id', 'name'}, 'probe-pins')
    shape(pins['artifact'], {'id', 'name', 'size_in_bytes', 'digest'}, 'probe-pins')
    for key, value in [(pins['run'], 'id'), (pins['run'], 'run_attempt'),
                       (pins['run'], 'workflow_id'), (pins['job'], 'id'),
                       (pins['artifact'], 'id'), (pins['artifact'], 'size_in_bytes')]:
        require(type(key[value]) is int and key[value] > 0, 'probe-pins')
    pins['expected'] = validate_expected(pins['expected'])
    require(pins['run']['conclusion'] == 'failure', 'probe-pins')
    require(pins['artifact']['size_in_bytes'] <= MAX_ZIP, 'probe-pins')
    require(pins['artifact']['digest'] == 'sha256:' + pins['expected']['outerSha256'],
            'probe-pins')
    require(pins['artifact']['name'] == 'agentfootprint-source-' +
            pins['expected']['source']['head'], 'probe-pins')
    return pins


def _validate_run(run, pins):
    require(type(run) is dict, 'provider-run')
    for key, expected in pins['run'].items():
        _same(run.get(key), expected, 'provider-run')
    _same(run.get('status'), 'completed', 'provider-run')
    _same(run.get('head_sha'), pins['expected']['source']['head'], 'provider-source')
    require(type(run.get('repository')) is dict and type(run.get('head_commit')) is dict,
            'provider-run')
    _same(run['repository'].get('full_name'), REPOSITORY, 'provider-repository')
    _same(run['repository'].get('id'), pins['repositoryId'], 'provider-repository')
    _same(run['head_commit'].get('id'), pins['expected']['source']['head'], 'provider-source')
    _same(run['head_commit'].get('tree_id'), pins['expected']['source']['tree'], 'provider-source')


def _validate_job(job, pins):
    require(type(job) is dict, 'provider-job')
    for key, expected in pins['job'].items():
        _same(job.get(key), expected, 'provider-job')
    _same(job.get('run_id'), pins['run']['id'], 'provider-job')
    _same(job.get('run_attempt'), pins['run']['run_attempt'], 'provider-attempt')
    _same(job.get('head_sha'), pins['expected']['source']['head'], 'provider-source')
    _same(job.get('status'), 'completed', 'provider-job')
    _same(job.get('conclusion'), 'success', 'provider-job')
    require(type(job.get('steps')) is list, 'provider-job-steps')
    for name in ['Retain original source candidate', UPLOAD_STEP]:
        found = [step for step in job['steps'] if type(step) is dict and step.get('name') == name]
        require(len(found) == 1, 'provider-job-steps')
        require(found[0].get('status') == 'completed' and
                found[0].get('conclusion') == 'success', 'provider-job-steps')


def _validate_artifact(artifact, pins):
    require(type(artifact) is dict, 'provider-artifact')
    for key, expected in pins['artifact'].items():
        _same(artifact.get(key), expected, 'provider-artifact')
    require(artifact.get('expired') is False, 'provider-artifact')
    run = artifact.get('workflow_run')
    require(type(run) is dict, 'provider-artifact-run')
    for key, expected in [('id', pins['run']['id']), ('repository_id', pins['repositoryId']),
                           ('head_repository_id', pins['repositoryId']),
                           ('head_branch', pins['run']['head_branch']),
                           ('head_sha', pins['expected']['source']['head'])]:
        _same(run.get(key), expected, 'provider-artifact-run')


def validate_metadata(run, job, artifact, pins):
    _validate_run(run, pins)
    _validate_job(job, pins)
    _validate_artifact(artifact, pins)


def api_refusal(stderr):
    found = re.search(r'\bHTTP\s*([45][0-9]{2})\b', stderr)
    return 'api-http-' + found[1] if found else 'api-read-failed'


class _GhApi:
    def __init__(self, work, pins):
        self.work, self.pins = work, pins
        require(os.environ.get('GITHUB_ACTIONS') == 'true' and
                os.environ.get('GITHUB_REPOSITORY') == CONSUMER, 'workflow-only')
        require(bool(os.environ.get('GH_TOKEN')), 'workflow-token')
        config = work / 'empty-gh-config'
        config.mkdir(mode=0o700)
        self.env = {key: os.environ[key] for key in ['HOME', 'PATH', 'LANG', 'LC_ALL']
                    if key in os.environ}
        self.env.update({'GH_TOKEN': os.environ['GH_TOKEN'], 'GH_HOST': 'github.com',
                         'GH_CONFIG_DIR': str(config), 'GH_PROMPT_DISABLED': '1', 'GH_PAGER': 'cat'})

    def _get(self, kind, limit):
        paths = {'run': f'actions/runs/{self.pins["run"]["id"]}',
                 'job': f'actions/jobs/{self.pins["job"]["id"]}',
                 'artifact': f'actions/artifacts/{self.pins["artifact"]["id"]}',
                 'zip': f'actions/artifacts/{self.pins["artifact"]["id"]}/zip'}
        require(kind in paths, 'api-kind')
        destination = self.work / (kind + ('.zip' if kind == 'zip' else '.json'))
        try:
            with destination.open('xb') as output:
                destination.chmod(0o600)
                result = subprocess.run(['gh', 'api', '--hostname', 'github.com', '--method', 'GET',
                                         'repos/' + REPOSITORY + '/' + paths[kind]],
                                        env=self.env, stdout=output, stderr=subprocess.PIPE,
                                        text=True, encoding='utf-8', errors='replace', timeout=40)
            if result.returncode:
                raise DataRefused(kind + '-' + api_refusal(result.stderr))
            require(0 < destination.stat().st_size <= limit, 'api-response-size')
            return destination
        except subprocess.TimeoutExpired:
            raise DataRefused(kind + '-api-timeout') from None
        except OSError:
            raise DataRefused(kind + '-api-unavailable') from None

    def read(self, kind):
        return parse_json(read_regular(self._get(kind, 2 * 1024 * 1024), 2 * 1024 * 1024))

    def archive(self):
        destination = self._get('zip', self.pins['artifact']['size_in_bytes'])
        _same(destination.stat().st_size, self.pins['artifact']['size_in_bytes'], 'provider-size')
        return destination


def _observe(work, pins):
    api = _GhApi(work, pins)
    run = api.read('run')
    _validate_run(run, pins)
    job = api.read('job')
    _validate_job(job, pins)
    artifact = api.read('artifact')
    _validate_artifact(artifact, pins)
    result = inspect_artifact(api.archive(), pins['expected'])
    result.update({'qualification': 'PROVISIONAL_DATA_ONLY_NOT_NATIVE_ACCEPTANCE',
                   'producerWholeCi': run['conclusion'],
                   'provider': {'repository': REPOSITORY, 'runId': run['id'],
                                'attempt': run['run_attempt'], 'jobId': job['id'],
                                'artifactId': artifact['id'], 'digest': artifact['digest'],
                                'sizeBytes': artifact['size_in_bytes']}})
    return result


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    try:
        require(not args, 'arguments')
        require(os.environ.get('GITHUB_ACTIONS') == 'true' and
                os.environ.get('GITHUB_REPOSITORY') == CONSUMER, 'workflow-only')
        require(bool(os.environ.get('GH_TOKEN')), 'workflow-token')
        temporary = Path(os.environ.get('RUNNER_TEMP', ''))
        require(bool(os.environ.get('RUNNER_TEMP')) and temporary.is_dir() and
                not temporary.is_symlink(), 'runner-temp')
        pins = load_pins()
        with tempfile.TemporaryDirectory(prefix='af-d3-data-probe-', dir=temporary) as directory:
            result = _observe(Path(directory), pins)
    except DataRefused as error:
        print(json.dumps({'status': 'REFUSED', 'activationAllowed': False,
                          'packageExecutionAllowed': False, 'reason': error.reason,
                          'qualification': 'PROVISIONAL_DATA_ONLY_NOT_NATIVE_ACCEPTANCE'}))
        return 2
    except OSError:
        print(json.dumps({'status': 'REFUSED', 'activationAllowed': False,
                          'packageExecutionAllowed': False, 'reason': 'probe-temp'}))
        return 2
    print(json.dumps(result, sort_keys=True))
    return 0
