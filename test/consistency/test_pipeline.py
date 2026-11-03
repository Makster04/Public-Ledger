import contextlib
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scripts.consistency import cli
from scripts.consistency.provider import OpenAIResponsesClient
from scripts.consistency.storage import Store


def fixture():
    return {"members": [{"id": "sample", "bioguide": "X000001", "name": "Fixture member", "party": "I",
        "statements": [{"topic": "School meals", "said": {"text": "I support expanding school meals.", "date": "2025-01-01",
            "src": {"u": "https://example.org/statement"}},
            "did": {"text": "Voted YES on the provision expanding school meals.", "date": "2025-02-01",
                    "src": {"u": "https://example.org/action"}}}]}]}


def config():
    return json.loads((Path(__file__).resolve().parents[2] / 'data/consistency/openai-responses.json').read_text())


def response():
    return {"status": "completed", "model": "gpt-6-luna", "output": [{"type": "message", "status": "completed",
        "content": [{"type": "output_text", "text": json.dumps({"classification": "consistent", "probabilities": {
            "consistent": .95, "inconsistent": .03, "not_relevant": .02}})}]}],
        "usage": {"input_tokens": 12, "output_tokens": 8, "total_tokens": 20}}


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.research = self.root / "research.json"
        self.research.write_text(json.dumps(fixture()))
        self.provider = self.root / "openai.json"
        self.provider.write_text(json.dumps(config()))
        self.report = self.root / "report.json"
        self.db = self.root / "jobs.sqlite"
        self.args = ["--research", str(self.research), "--output", str(self.report), "--database", str(self.db)]

    def tearDown(self):
        self.temp.cleanup()

    def invoke(self, command, *extra):
        with contextlib.redirect_stdout(io.StringIO()):
            return cli.main([command, *self.args, '--openai-config', str(self.provider), *extra])

    def test_prepare_without_key_no_network_and_no_fabricated_percentage(self):
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

    def test_prepare_with_openai_config_without_key(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(self.invoke('prepare'), 0)
            self.assertEqual(self.invoke('run'), 2)

    def test_full_mocked_flow_idempotency_and_changed_evidence_history(self):
        calls = []
        def transport(*args):
            calls.append(args)
            return 200, {}, response()
        def client(config, **kwargs):
            return OpenAIResponsesClient(config, api_key='fixture-secret', transport=transport, **kwargs)
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'fixture-secret'}, clear=True), patch.object(cli, 'OpenAIResponsesClient', client):
            self.assertEqual(self.invoke('run'), 0)
            self.assertEqual(self.invoke('run'), 0)
            self.assertEqual(len(calls), 1)
            report = json.loads(self.report.read_text())
            self.assertEqual(report['provider']['provider'], 'openai-responses')
            self.assertEqual(report['provider']['model'], 'gpt-6-luna')
            statement = report['people']['sample']['statements'][0]
            self.assertEqual(statement['percentage'], 100)
            self.assertEqual(statement['actions'][0]['actual_model'], 'gpt-6-luna')
            self.assertEqual(statement['actions'][0]['probability_semantics'], 'uncalibrated_model_estimates')
            self.assertNotIn('fixture-secret', self.report.read_text())
            data = fixture()
            data['members'][0]['statements'][0]['did']['text'] += ' The program covers all public schools.'
            self.research.write_text(json.dumps(data))
            self.assertEqual(self.invoke('run'), 0)
            self.assertEqual(len(calls), 2)
            with Store(self.db) as store:
                self.assertEqual(sum(len(store.history(k)) for k in {j['pair_key'] for j in store.jobs()}), 2)

    def test_missing_source_is_blocked_before_provider_call(self):
        data = fixture(); del data['members'][0]['statements'][0]['did']['src']
        self.research.write_text(json.dumps(data))
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'fixture-secret'}, clear=True), patch.object(OpenAIResponsesClient, 'classify', side_effect=AssertionError('must not classify')):
            self.assertEqual(self.invoke('run'), 0)
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
