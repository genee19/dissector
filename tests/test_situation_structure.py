import unittest
from datetime import datetime
import sys
import os

# Add src to sys.path to allow imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../src')))

from lib.situation_file_structure.situation import Situation
from lib.situation_file_structure.observation import Observation

class TestSituationStructure(unittest.TestCase):

    def test_observation_creation_valid(self):
        """Test creating a valid observation."""
        obs = Observation(id=1, summary="Something happened")
        self.assertEqual(obs.id, 1)
        self.assertEqual(obs.summary, "Something happened")
        self.assertEqual(obs.caused_by, [])

    def test_observation_self_reasoning_validation(self):
        """Test that self-reasoning (id in caused_by and length is 1) raises ValueError."""
        obs = Observation(id=1, caused_by=[1], summary="I am my own cause")
        with self.assertRaises(ValueError):
            obs.validate_self_reasoning()

    def test_observation_self_reasoning_allowed_if_other_causes_exist(self):
        """Test that self-reasoning is allowed if there are other causes."""
        # As per instructions: "The only thing that should be disallowed is self-reasoning - when an observation is only caused by itself and nothing else."
        obs = Observation(id=1, caused_by=[1, 2], summary="I am my own cause but also caused by 2")
        try:
            obs.validate_self_reasoning()
        except ValueError:
            self.fail("validate_self_reasoning() raised ValueError unexpectedly for mixed causes.")

    def test_situation_from_dict_valid(self):
        """Test creating a Situation from a dictionary."""
        data = {
            'name': 'Test Situation',
            'creator': 'Tester',
            'summary': 'A test summary',
            'created_at': datetime(2023, 10, 26, 12, 0, 0),
            'updated_at': datetime(2023, 10, 27, 12, 0, 0),
            'options': {'advanced': True},
            'tree': [
                {'id': 1, 'summary': 'Root', 'caused_by': []},
                {'id': 2, 'summary': 'Child', 'caused_by': [1]}
            ]
        }
        situation = Situation.from_dict(data)
        self.assertEqual(situation.name, 'Test Situation')
        self.assertEqual(len(situation.tree), 2)
        self.assertEqual(situation.tree[1].caused_by, [1])

    def test_situation_detects_self_reasoning_in_tree(self):
        """Test that Situation.from_dict validates observations in the tree."""
        data = {
            'name': 'Bad Logic',
            'creator': 'Tester',
            'summary': 'Summary',
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
            'tree': [
                {'id': 1, 'summary': 'Self', 'caused_by': [1]}
            ]
        }
        with self.assertRaises(ValueError):
            Situation.from_dict(data)

    def test_situation_allows_cycles(self):
        """Test that circular reasoning between different observations is allowed."""
        data = {
            'name': 'Circular Logic',
            'creator': 'Tester',
            'summary': 'Summary',
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
            'tree': [
                {'id': 1, 'summary': 'A', 'caused_by': [2]},
                {'id': 2, 'summary': 'B', 'caused_by': [1]}
            ]
        }
        try:
            situation = Situation.from_dict(data)
            self.assertEqual(len(situation.tree), 2)
        except ValueError:
            self.fail("Situation raised ValueError for allowed circular logic (1->2->1).")

    def test_situation_allows_disconnected_graphs(self):
        """Test that disconnected sub-trees are allowed."""
        data = {
            'name': 'Disconnected',
            'creator': 'Tester',
            'summary': 'Summary',
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
            'tree': [
                {'id': 1, 'summary': 'Tree 1 Root', 'caused_by': []},
                {'id': 2, 'summary': 'Tree 1 Child', 'caused_by': [1]},
                {'id': 3, 'summary': 'Tree 2 Root', 'caused_by': []}
            ]
        }
        try:
            situation = Situation.from_dict(data)
            self.assertEqual(len(situation.tree), 3)
        except Exception as e:
            self.fail(f"Situation raised exception for disconnected graphs: {e}")

    def test_situation_allows_one_cause_for_multiple_observations(self):
        """Test that a single observation can cause multiple other observations."""
        data = {
            'name': 'Branching Logic',
            'creator': 'Tester',
            'summary': 'Summary',
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
            'tree': [
                {'id': 1, 'summary': 'Root Cause', 'caused_by': []},
                {'id': 2, 'summary': 'Effect 1', 'caused_by': [1]},
                {'id': 3, 'summary': 'Effect 2', 'caused_by': [1]}
            ]
        }
        try:
            situation = Situation.from_dict(data)
            self.assertEqual(len(situation.tree), 3)
            self.assertEqual(situation.tree[1].caused_by, [1])
            self.assertEqual(situation.tree[2].caused_by, [1])
        except Exception as e:
            self.fail(f"Situation raised exception for branching logic (1 causes 2 and 3): {e}")

if __name__ == '__main__':
    unittest.main()
