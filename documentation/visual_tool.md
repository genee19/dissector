# Visual Tool Documentation

## Overview
The visual tool for Dissector is designed to provide an interactive, browser-based interface for visualizing and manipulating the causal reasoning trees defined in the `tree.yaml` files.

## Core Requirements

### Platform & Technology
*   **Frontend**: Web Browser (The tool must run in a standard modern web browser).
*   **Backend**: Python.

### Workflow & Interface

#### 1. Project Selection Screen
*   **Initial View**: Upon opening the tool, the user is presented with a "Project Selector" interface.
*   **Functionality**:
    *   **Create New**: Option to start a new project (creating a new subfolder and `tree.yaml`).
    *   **Open Existing**: Lists available projects found in the `/situations` directory.
    *   **Listing Details**: Projects are listed by their names as defined in their respective `tree.yaml` files (not just folder names).

#### 2. Project Workspace
Once a project is opened or created, the interface splits into two main areas (plus a conditional third area):

**Header Area:**
*   **Project Metadata**: Displays top-level fields (Name, Creator, Summary, etc.).
*   **Editing**:
    *   Fields are editable inline.
    *   **Placeholders**: If a new project is created, placeholders are displayed for Name, Creator, and Summary.
    *   **Saving**: Changes are applied and saved automatically after a **debounce of 500ms**.
*   **Navigation**: Contains a "Back" button to return to the Project Selector screen.

**Project Editing Area (Main Workspace):**
*   **Visualization**: The main workspace takes up the remaining screen real estate.
*   **Empty State**: When the project has no observations, a placeholder message "Double click anywhere to add an observation" is displayed in the center.
*   **Creating Observations**: Double-clicking any empty area in the workspace:
    1.  Creates a new observation.
    2.  Selects the new observation (opening the Right Panel).
    3.  Automatically focuses the **Summary** editor in the Right Panel.
*   **Scrolling**: The visualization area will support both horizontal and vertical scrolling to navigate large graphs of observations that do not fit entirely on a single screen.
*   **Visual Metaphor**: "Post-it" style rectangles representing individual observations.
*   **Card Content**: Each "Post-it" displays the `summary` and a snippet of the `description`.
*   **Selection**: Clicking a "Post-it" selects it, opens the Right Panel, and automatically focuses the **Summary** editor in the Right Panel.
*   **Deleting Observations**:
    *   **UI Control**: When an observation is selected, a delete button (round, trashcan icon) appears in the bottom-left corner of the "Post-it", vertically aligned with the bottom border.
    *   **Confirmation Flow**:
        1.  Clicking the delete button expands a semi-transparent background to the left.
        2.  A label "Really delete?" slides out.
        3.  The delete button slides to the right.
        4.  A "Cancel" button (diagonal cross icon) appears to the right of the delete button. Clicking it resets the control.
        5.  Clicking the delete button a second time (after confirmation) triggers the deletion.
    *   **Handling Links**:
        *   **Reciprocal Nodes**: Nodes that are caused by the current one and in turn cause the current one are ignored in the process of identifying if the node is intermediate or leaf/root.
        *   **Intermediate Nodes**: If the observation is "in the middle" (has both causes and effects, and they are distinct, reciprocal nodes are not considered), a dialog prompts the user:
            *   **Stretch**: Connect causing observations directly to dependent observations.
            *   **Break**: Delete all incoming and outgoing links (default behavior).
            *   **Cancel**: Abort deletion.
        *   **Leaf/Root Nodes**: If the observation has only incoming OR only outgoing links (or none), the links are broken (deleted) automatically without prompting.
*   **Linking Observations**:
    *   **UI Control**: When an observation is selected, a fully round button with an "arrow originating from a dot" icon appears on the **top border** of the "Post-it". Hovering shows a "move" cursor.
    *   **Link Mode**:
        *   **Visual State**: Nodes *not* yet linked to the selected node are highlighted. Nodes *already* linked (or the selected node itself, depending on validation logic) are dimmed (semi-transparent).
        *   **Activation (Click)**: Clicking the link button enters Link Mode.
            *   **Action**: Clicking a highlighted node creates a link where the **Selected Node causes the Clicked Node** (Clicked Node `caused_by` Selected Node). The selection remains on the original node. The graph returns to Normal Mode.
            *   **Cancel**: Clicking outside any highlighted node (empty area or dimmed node) cancels Link Mode.
        *   **Activation (Drag)**: Dragging the link button enters Link Mode.
            *   **Action**: Releasing the drag on a highlighted node creates the link.
            *   **Cancel**: Releasing the drag elsewhere cancels the operation.
            *   **Auto-Scroll**: While dragging, if the cursor enters the outermost **25%** of the visible editor area (top, bottom, left, or right strips), the view scrolls in that direction. Speed increases as the cursor moves closer to the edge.
    *   **Persistence & Rebalancing**: Once a link is successfully created (either via click or drag), the change is immediately applied to the in-memory graph, saved to the `tree.yaml` file, and the entire graph is visually rebalanced to reflect the new connection.
*   **Deleting Links**:
    *   **UI Interaction**:
        *   **Hover**: Hovering over a link arrow highlights it slightly (indicating interactivity) after a default debounce to prevent flickering.
        *   **Selection**: Clicking a link selects it (highlighted) and updates the Right Panel.
    *   **Right Panel (Link View)**:
        *   **Content**: Displays two "Post-it" representations:
            *   **Top**: The *causing* observation (Summary & Description visible).
            *   **Label**: A label "... which is why ..." connects the top and bottom cards.
            *   **Bottom**: The *caused* (effect) observation (standing at the end of the arrow).
        *   **Deletion Control**: A delete button appears below the bottom card.
            *   **Behavior**: Identical to the observation delete button (Confirmation question -> "Really delete?" -> Confirm/Cancel buttons).
        *   **Action**: Confirming deletion removes the link, immediately updates the in-memory graph and file, and triggers a visual rebalance.

**Right Panel (Detail View):**
*   **Visibility**: Hidden by default. Slides in or appears on the right side when an observation is selected.
*   **Close Button**: Located in the top-left corner of the panel. Collapses the panel and unselects the observation.
*   **Content & Editing**:
    *   **Summary**: Displayed prominently (approx. `h2` size). Editable in-place (plain text).
    *   **Description**: Rich HTML display. Turns into a multi-line Markdown editor on click.
    *   **Attachments**:
        *   List of existing attachments as a list of `<a href="..."> links to open the files.
        *   Delete button (fades in on hover) for each attachment.
        *   "Add File" button.
    *   **Comments**:
        *   List of comment cards.
        *   Rich HTML display, smaller font than description.
        *   Editable on click (turns into a multi-line Markdown editor).
        *   Each comment card includes a delete button that fades into view when hovered.
        *   "Add Comment" button.
    *   **Solution**: Collapsible section. Rich HTML display that turns into a multi-line Markdown editor on click, similar to the description and comments.
    *   **Saving Changes**: All modifications made within the Right Panel (to Summary, Description, Attachments, Comments, Solution) are applied to the in-memory graph representation and then saved persistently to the `tree.yaml` file after a **debounce of 500ms**.

### Visualization Logic
*   **Graph Representation**: The Dissector tool visually represents the observations and their causal relationships as a directed graph. Each "Post-it" rectangle corresponds to an observation (node), and each connection between them is rendered as an arrow (edge) depicting causality.
*   **Layout Algorithm**:
    *   **Automatic**: Any suitable graph layout algorithm will be used to visually balance the graph of observations. The algorithm will handle positioning to ensure a clean and readable display, accommodating cycles and disconnected components.
    *   **No Manual Dragging**: The user has *no control* over the specific xy-coordinates of the items; the system handles placement.
*   **Connections**:
    *   **Representation**: Arrows representing causation. An arrow going from item A to item B means that item A causes item B.
    *   **Direction**: An arrow points from the **center** of the causing observation's "Post-it" to the **center** of the caused observation's "Post-it".
