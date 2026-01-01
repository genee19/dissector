import unittest
from datetime import datetime
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../src')))

from lib.situation_file_structure.situation import Situation
from lib.situation_file_structure.observation import Observation

class TestDeletion(unittest.TestCase):

    def setUp(self):
        self.base_data = {
            'name': 'Test', 'creator': 'Tester', 'summary': 'Sum',
            'created_at': datetime.now(), 'updated_at': datetime.now(),
            'tree': []
        }

    def test_delete_leaf_break(self):
        """Test deleting a leaf node (only incoming links) with break mode."""
        self.base_data['tree'] = [
            {'id': 1, 'summary': 'Root', 'caused_by': []},
            {'id': 2, 'summary': 'Leaf', 'caused_by': [1]}
        ]
        sit = Situation.from_dict(self.base_data)
        
        self.assertFalse(sit.is_intermediate_node(2))
        sit.delete_observation(2, mode='break')
        
        self.assertIsNone(sit.get_observation(2))
        self.assertEqual(len(sit.tree), 1)

    def test_delete_root_break(self):
        """Test deleting a root node (only outgoing links) with break mode."""
        self.base_data['tree'] = [
            {'id': 1, 'summary': 'Root', 'caused_by': []},
            {'id': 2, 'summary': 'Leaf', 'caused_by': [1]}
        ]
        sit = Situation.from_dict(self.base_data)
        
        self.assertFalse(sit.is_intermediate_node(1)) # Root is not intermediate
        sit.delete_observation(1, mode='break')
        
        self.assertIsNone(sit.get_observation(1))
        obs2 = sit.get_observation(2)
        self.assertEqual(obs2.caused_by, []) # Link broken

    def test_delete_intermediate_break(self):
        """Test deleting an intermediate node with break mode (links destroyed)."""
        self.base_data['tree'] = [
            {'id': 1, 'summary': 'Cause', 'caused_by': []},
            {'id': 2, 'summary': 'Middle', 'caused_by': [1]},
            {'id': 3, 'summary': 'Effect', 'caused_by': [2]}
        ]
        sit = Situation.from_dict(self.base_data)
        
        self.assertTrue(sit.is_intermediate_node(2))
        sit.delete_observation(2, mode='break')
        
        self.assertIsNone(sit.get_observation(2))
        obs3 = sit.get_observation(3)
        self.assertEqual(obs3.caused_by, []) # 1 -> 3 connection NOT formed

    def test_delete_intermediate_stretch(self):
        """Test deleting an intermediate node with stretch mode (links preserved)."""
        self.base_data['tree'] = [
            {'id': 1, 'summary': 'Cause', 'caused_by': []},
            {'id': 2, 'summary': 'Middle', 'caused_by': [1]},
            {'id': 3, 'summary': 'Effect', 'caused_by': [2]}
        ]
        sit = Situation.from_dict(self.base_data)
        
        self.assertTrue(sit.is_intermediate_node(2))
        sit.delete_observation(2, mode='stretch')
        
        self.assertIsNone(sit.get_observation(2))
        obs3 = sit.get_observation(3)
        self.assertEqual(obs3.caused_by, [1]) # 1 -> 3 connection formed

    def test_delete_reciprocal_detection(self):
        """Test that reciprocal nodes (A<->B) are NOT considered intermediate."""
        self.base_data['tree'] = [
            {'id': 1, 'summary': 'A', 'caused_by': [2]},
            {'id': 2, 'summary': 'B', 'caused_by': [1]}
        ]
        sit = Situation.from_dict(self.base_data)
        
        # 1 is caused by 2, causes 2. set(causes)={2}, set(effects)={2}. 
        self.assertFalse(sit.is_intermediate_node(1))
        
        sit.delete_observation(1, mode='break') # Should just break
        obs2 = sit.get_observation(2)
        self.assertEqual(obs2.caused_by, [])

    def test_delete_complex_stretch(self):
        """Test stretching with multiple causes and effects."""
        # 1, 2 -> Middle(3) -> 4, 5
        self.base_data['tree'] = [
            {'id': 1, 'summary': 'C1', 'caused_by': []},
            {'id': 2, 'summary': 'C2', 'caused_by': []},
            {'id': 3, 'summary': 'Mid', 'caused_by': [1, 2]},
            {'id': 4, 'summary': 'E1', 'caused_by': [3]},
            {'id': 5, 'summary': 'E2', 'caused_by': [3]}
        ]
        sit = Situation.from_dict(self.base_data)
        
        self.assertTrue(sit.is_intermediate_node(3))
        sit.delete_observation(3, mode='stretch')
        
        obs4 = sit.get_observation(4)
        obs5 = sit.get_observation(5)
        
        # Both 4 and 5 should now be caused by 1 and 2
        self.assertCountEqual(obs4.caused_by, [1, 2])
        self.assertCountEqual(obs5.caused_by, [1, 2])

    def test_stretch_avoids_self_reasoning(self):
        """Test that stretch avoids creating a purely self-reasoning node."""
        # A(1) -> B(2) -> A(1)
        # Deleting B stretch: A's cause B replaced by A. A->A.
        self.base_data['tree'] = [
            {'id': 1, 'summary': 'A', 'caused_by': [2]},
            {'id': 2, 'summary': 'B', 'caused_by': [1]}
        ]
        sit = Situation.from_dict(self.base_data)
        
        # Even though reciprocal check returns False, let's force stretch to see safety
        sit.delete_observation(2, mode='stretch')
        
        obs1 = sit.get_observation(1)
        # Should be empty, not [1]
        self.assertEqual(obs1.caused_by, [])

    def test_multiple_reciprocals(self):
        """Test that a node with multiple reciprocal connections is considered intermediate."""
        # A(1) <-> B(2) AND A(1) <-> C(3)
        # 1 caused by 2, 3. 1 causes 2, 3.
        # Distinct flows: 2->1->3 and 3->1->2 exist.
        self.base_data['tree'] = [
            {'id': 1, 'summary': 'A', 'caused_by': [2, 3]},
            {'id': 2, 'summary': 'B', 'caused_by': [1]},
            {'id': 3, 'summary': 'C', 'caused_by': [1]}
        ]
        sit = Situation.from_dict(self.base_data)
        
        self.assertTrue(sit.is_intermediate_node(1))
        
        # If we stretch 1, B should become caused by 3 (and itself, technically), 
        # and C caused by 2 (and itself).
        sit.delete_observation(1, mode='stretch')
        
        obs2 = sit.get_observation(2)
        obs3 = sit.get_observation(3)
        
        # B caused by {2, 3}. 
        # Note: 2 causes 2 is allowed if 3 causes 2 is also present.
        self.assertCountEqual(obs2.caused_by, [2, 3])
        self.assertCountEqual(obs3.caused_by, [2, 3])

if __name__ == '__main__':
    unittest.main()
