import contextlib
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scripts.consistency import cli
from scripts.consistency.provider import JEVClient
from scripts.consistency.storage import Store


def fixture():
    return {"members": [{"id": "sample", "bioguide": "X000001", "name": "Fixture member", "party": "I",
        "statements": [{"topic": "School meals", "said": {"text": "I support expanding school meals.", "date": "2025-01-01",
            "src": {"u": "https://example.org/statement"}},
            "did": {"text": "Voted YES on the provision expanding school meals.", "date": "2025-02-01",
                    "src": {"u": "https://example.org/action"}}}]}]}


def manifest():
    return {"reviewed": True, "endpoint": "https://example.org/classify", "docs_url": "https://example.org/docs",
            "model": "fixture-model", "model_version": "1", "auth_header": "Authorization", "auth_prefix": "Bearer ",
            "request_template": {"context": "{{context}}", "rubric": "{{rubric}}", "model": "{{model}}"},
            "response_paths": {"classification": "classification", "probabilities": "probabilities"}}


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.research = self.root / "research.json"
        self.research.write_text(json.dumps(fixture()))
        self.provider = self.root / "provider.json"
        self.provider.write_text(json.dumps(manifest()))
        self.report = self.root / "report.json"
        self.db = self.root / "jobs.sqlite"
        self.args = ["--research", str(self.research), "--output", str(self.report), "--database", str(self.db)]

    def tearDown(self):
        self.temp.cleanup()

    def invoke(self, command, *extra):
        with contextlib.redirect_stdout(io.StringIO()):
            return cli.main([command, *self.args, *extra])

    def test_prepare_no_provider_no_network_and_no_fabricated_percentage(self):
        with patch.dict(os.environ, {}, clear=True), patch('urllib.request.OpenerDirector.open', side_effect=AssertionError('network')):
            self.assertEqual(self.invoke('prepare'), 0)
            self.assertEqual(self.invoke('prepare'), 0)
            report = json.loads(self.report.read_text())
            result = report['people']['sample']['statements'][0]
            self.assertIsNone(result['percentage'])
            self.assertEqual(result['counts']['review'], 1)
            with Store(self.db) as store:
                self.assertEqual(len(store.jobs()), 1)
            self.assertEqual(self.invoke('run'), 2)

    def test_prepare_with_manifest_without_key(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(self.invoke('prepare', '--provider', str(self.provider)), 0)
            self.assertEqual(self.invoke('run', '--provider', str(self.provider)), 2)

    def test_full_mocked_flow_idempotency_and_changed_evidence_history(self):
        calls = []
        def transport(*args):
            calls.append(args)
            return 200, {}, {'classification': 'consistent', 'probabilities': {
                'consistent': .95, 'inconsistent': .03, 'not_relevant': .02}}
        def client(config, **kwargs):
            return JEVClient(config, transport=transport, **kwargs)
        with patch.dict(os.environ, {'JEV_API_KEY': 'fixture-secret'}, clear=True), patch.object(cli, 'JEVClient', client):
            self.assertEqual(self.invoke('run', '--provider', str(self.provider)), 0)
            self.assertEqual(self.invoke('run', '--provider', str(self.provider)), 0)
            self.assertEqual(len(calls), 1)
            report = json.loads(self.report.read_text())
            self.assertEqual(report['people']['sample']['statements'][0]['percentage'], 100)
            self.assertNotIn('fixture-secret', self.report.read_text())
            data = fixture()
            data['members'][0]['statements'][0]['did']['text'] += ' The program covers all public schools.'
            self.research.write_text(json.dumps(data))
            self.assertEqual(self.invoke('run', '--provider', str(self.provider)), 0)
            self.assertEqual(len(calls), 2)
            with Store(self.db) as store:
                self.assertEqual(sum(len(store.history(k)) for k in {j['pair_key'] for j in store.jobs()}), 2)

    def test_missing_source_is_blocked_before_provider_call(self):
        data = fixture(); del data['members'][0]['statements'][0]['did']['src']
        self.research.write_text(json.dumps(data))
        with patch.dict(os.environ, {'JEV_API_KEY': 'fixture-secret'}, clear=True), patch.object(JEVClient, 'classify', side_effect=AssertionError('must not classify')):
            self.assertEqual(self.invoke('run', '--provider', str(self.provider)), 0)
        result = json.loads(self.report.read_text())['people']['sample']['statements'][0]
        self.assertIsNone(result['percentage'])
        self.assertEqual(result['actions'][0]['status'], 'blocked')

    def test_supplemental_identity_mismatch_rejected(self):
        supplemental = self.root / 'extra.json'
        supplemental.write_text(json.dumps({'people': [{'person_id': 'bioguide:X000001',
            'actions': [{'id': 'bad', 'person_id': 'bioguide:OTHER', 'text': 'School meals'}]}]}))
        self.assertEqual(self.invoke('prepare', '--records', str(supplemental)), 2)

    def test_supplemental_invalid_citation_cannot_enter_resolved_evidence(self):
        supplemental = self.root / 'extra.json'
        supplemental.write_text(json.dumps({'people': [{'person_id': 'bioguide:X000001',
            'actions': [{'id': 'new', 'person_id': 'bioguide:X000001', 'text': 'Expanded school meals',
                         'date': '2025-03-01', 'kind': 'vote', 'role': 'Yea',
                         'sources': [{'url': 'javascript:alert(1)'}]}]}]}))
        people = cli.read_people(self.research, supplemental)
        action = next(a for a in people[0]['actions'] if a['id'] == 'new')
        self.assertEqual(action['sources'], [])
        candidates = cli.select_candidates(people[0]['statements'][0], people[0]['actions'])
        candidate = next(p for p in candidates if p['action']['id'] == 'new')
        self.assertIn('missing_action_source', candidate['review_reasons'])


if __name__ == '__main__':
    unittest.main()
