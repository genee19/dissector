from dataclasses import dataclass, field
from typing import List, Optional

@dataclass
class Observation:
    id: int
    caused_by: List[int] = field(default_factory=list)
    summary: str = ""
    description: str = ""
    attachments: List[str] = field(default_factory=list)
    comments: List[str] = field(default_factory=list)
    solution: Optional[str] = None

    def validate_self_reasoning(self):
        """
        Validates that the observation is not its sole cause.
        """
        if len(self.caused_by) == 1 and self.caused_by[0] == self.id:
            raise ValueError(f"Observation {self.id} cannot be its own sole cause.")
