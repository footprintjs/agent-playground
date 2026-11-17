import contextlib
import copy
import io
import json
import os
import unittest
from unittest.mock import patch

from .probe import UPLOAD_STEP, api_refusal, load_pins, main, validate_metadata
from .receipt import DataRefused


def provider_fixture(pins):
    source = pins['expected']['source']
    run = dict(pins['run']) | {'status': 'completed', 'head_sha': source['head'],
                              'repository': {'id': pins['repositoryId'],
                                             'full_name': pins['repository']},
                              'head_commit': {'id': source['head'], 'tree_id': source['tree']}}
    job = dict(pins['job']) | {'run_id': run['id'], 'run_attempt': run['run_attempt'],
                              'head_sha': source['head'], 'status': 'completed',
                              'conclusion': 'success', 'steps': [
                                  {'name': name, 'status': 'completed', 'conclusion': 'success'}
                                  for name in ['Retain original source candidate', UPLOAD_STEP]]}
    artifact = dict(pins['artifact']) | {'expired': False, 'workflow_run': {
        'id': run['id'], 'repository_id': pins['repositoryId'],
        'head_repository_id': pins['repositoryId'], 'head_branch': run['head_branch'],
        'head_sha': source['head']}}
    return run, job, artifact


class ProviderTests(unittest.TestCase):
    def setUp(self):
        self.pins = load_pins()
        self.metadata = provider_fixture(self.pins)

    def test_exact_provider_tuple_observes_the_failed_run_without_promoting_it(self):
        before = copy.deepcopy(self.metadata)
        self.assertIsNone(validate_metadata(*self.metadata, self.pins))
        self.assertEqual(self.metadata, before)
        self.assertEqual(self.metadata[0]['conclusion'], 'failure')
        self.assertEqual(self.metadata[1]['conclusion'], 'success')

    def test_wrong_run_head_job_artifact_digest_and_size_are_refused(self):
        changes = [(0, ('id',), 1), (0, ('run_attempt',), 2),
                   (0, ('head_sha',), '0' * 40), (0, ('head_commit', 'tree_id'), '0' * 40),
                   (0, ('conclusion',), 'success'), (0, ('repository', 'id'), 1),
                   (1, ('id',), 1), (1, ('run_id',), 1), (1, ('run_attempt',), 2),
                   (1, ('head_sha',), '0' * 40), (1, ('conclusion',), 'failure'),
                   (2, ('id',), 1), (2, ('name',), 'other'), (2, ('digest',), 'sha256:' + '0' * 64),
                   (2, ('size_in_bytes',), 1), (2, ('expired',), True),
                   (2, ('workflow_run', 'id'), 1),
                   (2, ('workflow_run', 'head_sha'), '0' * 40),
                   (2, ('workflow_run', 'head_repository_id'), 1)]
        for index, keys, value in changes:
            metadata = copy.deepcopy(self.metadata)
            target = metadata[index]
            for key in keys[:-1]:
                target = target[key]
            target[keys[-1]] = value
            with self.subTest(index=index, keys=keys), self.assertRaises(DataRefused):
                validate_metadata(*metadata, self.pins)

    def test_package_retention_steps_must_succeed_once(self):
        for steps in [[], self.metadata[1]['steps'] * 2,
                      [{'name': name, 'status': 'completed', 'conclusion': 'skipped'}
                       for name in ['Retain original source candidate', UPLOAD_STEP]]]:
            metadata = copy.deepcopy(self.metadata)
            metadata[1]['steps'] = steps
            with self.subTest(steps=steps), self.assertRaisesRegex(DataRefused, 'provider-job-steps'):
                validate_metadata(*metadata, self.pins)

    def test_access_errors_are_fixed_without_echoing_provider_or_authentication_text(self):
        for code in [403, 404]:
            self.assertEqual(api_refusal(f'private detail (HTTP {code}) hidden'), f'api-http-{code}')
        self.assertEqual(api_refusal('arbitrary diagnostic text'), 'api-read-failed')

    def test_desktop_invocation_cannot_fall_back_to_an_existing_login(self):
        output = io.StringIO()
        with patch.dict(os.environ, {'GITHUB_ACTIONS': 'false'}), contextlib.redirect_stdout(output):
            code = main([])
        self.assertEqual(code, 2)
        result = json.loads(output.getvalue())
        self.assertEqual(result['reason'], 'workflow-only')
        self.assertIs(result['activationAllowed'], False)
