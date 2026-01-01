from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Optional, Any, Set
import yaml
from .observation import Observation

@dataclass
class Situation:
    name: str
    creator: str
    summary: str
    created_at: datetime
    updated_at: datetime
    options: Dict[str, Any] = field(default_factory=dict)
    tree: List[Observation] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Situation':
        observations_data = data.get('tree', [])
        observations = []
        for obs_data in observations_data:
            obs = Observation(
                id=obs_data['id'],
                caused_by=obs_data.get('caused_by', []),
                summary=obs_data.get('summary', ""),
                description=obs_data.get('description', ""),
                attachments=obs_data.get('attachments', []),
                comments=obs_data.get('comments', []),
                solution=obs_data.get('solution')
            )
            obs.validate_self_reasoning()
            observations.append(obs)

        return cls(
            name=data['name'],
            creator=data['creator'],
            summary=data['summary'],
            created_at=data['created_at'],
            updated_at=data['updated_at'],
            options=data.get('options', {}),
            tree=observations
        )

    @classmethod
    def from_yaml(cls, yaml_content: str) -> 'Situation':
        data = yaml.safe_load(yaml_content)
        return cls.from_dict(data)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'name': self.name,
            'creator': self.creator,
            'summary': self.summary,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'options': self.options,
            'tree': [
                {
                    'id': obs.id,
                    'caused_by': obs.caused_by,
                    'summary': obs.summary,
                    'description': obs.description,
                    'attachments': obs.attachments,
                    'comments': obs.comments,
                    'solution': obs.solution
                }
                for obs in self.tree
            ]
        }

    def get_observation(self, observation_id: int) -> Optional[Observation]:
        """Returns the observation with the given ID, or None if not found."""
        for obs in self.tree:
            if obs.id == observation_id:
                return obs
        return None

    def get_outgoing_effects(self, observation_id: int) -> List[Observation]:
        """Returns a list of observations that are caused by the given observation ID."""
        effects = []
        for obs in self.tree:
            if observation_id in obs.caused_by:
                effects.append(obs)
        return effects

    def is_intermediate_node(self, observation_id: int) -> bool:
        """
        Determines if a node is 'intermediate'.
        
        Definition: An intermediate node is one where there exists at least one 
        incoming cause and one outgoing effect that are NOT the same observation.
        
        This implies a 'flow' of causality passing through the node.
        If all causes are also effects (and vice versa) in a 1-to-1 mapping 
        (like a single reciprocal loop A<->B), then it's not considered intermediate 
        for the purpose of the 'break/stretch' decision, as stretching A<->B 
        would just result in B->B (which is either a self-loop or invalid).
        """
        obs = self.get_observation(observation_id)
        if not obs:
            return False
        
        causes = set(obs.caused_by)
        effects = {e.id for e in self.get_outgoing_effects(observation_id)}

        if not causes or not effects:
            return False
        
        # Check if there is ANY cause that is different from ANY effect.
        # If we find such a pair, the node is intermediate.
        for cause_id in causes:
            for effect_id in effects:
                if cause_id != effect_id:
                    return True
        
        return False

    def delete_observation(self, observation_id: int, mode: str = 'break') -> None:
        """
        Deletes an observation.
        
        Args:
            observation_id: The ID of the observation to delete.
            mode: 'break' to remove links, 'stretch' to connect causes to effects.
        """
        target_obs = self.get_observation(observation_id)
        if not target_obs:
            return # Or raise ValueError

        effects = self.get_outgoing_effects(observation_id)

        if mode == 'stretch':
            # Add target's causes to target's effects
            for effect in effects:
                # Remove target from effect's causes
                if observation_id in effect.caused_by:
                    effect.caused_by.remove(observation_id)
                
                # Add target's causes to effect's causes
                for cause_id in target_obs.caused_by:
                    if cause_id not in effect.caused_by:
                        effect.caused_by.append(cause_id)
                
                # Validation: Check if this created an invalid self-reasoning loop
                # (i.e., the node became its own SOLE cause)
                try:
                    effect.validate_self_reasoning()
                except ValueError:
                    # If stretch resulted in [effect_id] (sole cause), we must fix it.
                    # We remove the self-reference, leaving it with [] (Root) 
                    # or it had other causes and wouldn't have failed.
                    if effect.id in effect.caused_by:
                         effect.caused_by.remove(effect.id)

        elif mode == 'break':
            # Just remove target from all effects' caused_by lists
            for effect in effects:
                if observation_id in effect.caused_by:
                    effect.caused_by.remove(observation_id)
        
        else:
            raise ValueError(f"Unknown deletion mode: {mode}")

        # Finally, remove the observation itself
        self.tree.remove(target_obs)

    def add_observation(self, summary: str = "New Observation", description: str = "") -> Observation:
        """Creates a new observation with an auto-incremented ID."""
        max_id = max([obs.id for obs in self.tree], default=0)
        new_obs = Observation(
            id=max_id + 1,
            caused_by=[],
            summary=summary,
            description=description,
            attachments=[],
            comments=[],
            solution=""
        )
        self.tree.append(new_obs)
        self.updated_at = datetime.now()
        return new_obs

    def create_link(self, from_id: int, to_id: int) -> bool:
        """
        Creates a link from one observation to another.
        The link means: from_id causes to_id (to_id is caused_by from_id).
        Returns True if successful, False if observations not found.
        """
        from_obs = self.get_observation(from_id)
        to_obs = self.get_observation(to_id)
        
        if not from_obs or not to_obs:
            return False
        
        if from_id not in to_obs.caused_by:
            to_obs.caused_by.append(from_id)
            self.updated_at = datetime.now()
        
        return True

    def delete_link(self, from_id: int, to_id: int) -> bool:
        """
        Deletes a link between observations.
        Returns True if successful, False if observations not found.
        """
        to_obs = self.get_observation(to_id)
        
        if not to_obs:
            return False
        
        if from_id in to_obs.caused_by:
            to_obs.caused_by.remove(from_id)
            self.updated_at = datetime.now()
        
        return True

    def to_yaml(self) -> str:
        """Converts the situation to a YAML string."""
        return yaml.dump(self.to_dict(), default_flow_style=False, allow_unicode=True)

    def save_to_file(self, filepath: str) -> None:
        """Saves the situation to a YAML file."""
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(self.to_yaml())
