# Situation File Format
Each situation is described by a YAML file named `tree.yaml` located in its specific subfolder.

### Top-Level Structure
*   **`name`**: (String) Name of the situation.
*   **`creator`**: (String) Name of the creator.
*   **`summary`**: (String) Brief summary of the situation.
*   **`created_at`**: (Timestamp) Creation timestamp.
*   **`updated_at`**: (Timestamp) Last update timestamp.
*   **`options`**: (Structure) Placeholder for various future enhancements and configuration options.
*   **`tree`**: (List) A collection of observation structures.

### Observation Structure
Each item in the `tree` list represents an observation and contains:
*   **`id`**: (Numeric) Auto-incremented unique identifier for the observation.
*   **`caused_by`**: (List of Numbers) IDs of other observations that are identified as reasons for this observation.
*   **`summary`**: (String) Plain text summary of the observation.
*   **`description`**: (Markdown) Detailed description of the observation.
*   **`attachments`**: (List) A collection of texts or filenames of files located adjacent to `tree.yaml`.
*   **`comments`**: (List of Markdown) A collection of comments.
*   **`solution`**: (Markdown) Ideas or plans for solving the issue represented by this observation.

#### Causal Relationships (`caused_by` field):
*   **Allowed Cycles:** The `caused_by` relationships can form directed cycles, representing self-perpetuating problems or feedback loops. Identifying these loops is a key goal of the Dissector method, as they highlight areas where intervention can break a cycle of causality.
*   **Allowed Multiple Causes:** An observation can be caused by multiple distinct observations. This indicates that the issue is the result of multiple factors, and it may require a multi-faceted approach to solving it.
*   **Allowed Multiple Causation:** An observation can cause multiple distinct observations. This indicates that the issue is the cause of multiple effects.
*   **Allowed Disconnected Graphs:** The overall `tree` collection can contain multiple disconnected sub-graphs. This indicates distinct problem domains or areas of investigation that may or may not converge during the dissection process.
*   **Disallowed Self-Reasoning:** An observation cannot be its *sole* cause. If an observation's `caused_by` list consists *only* of its own `id`, it is considered an invalid and uninformative state. An observation must either have no causes (making it a root cause) or be caused by at least one other distinct observation (or multiple, including itself, but not *only* itself).
