"""
Flask web server for the Dissector visual tool.
Provides REST API endpoints for managing situations, observations, and links.
"""

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from datetime import datetime
from pathlib import Path
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from lib.situation_file_structure.situation import Situation
from lib.situation_file_structure.observation import Observation

app = Flask(__name__, static_folder='static')
CORS(app)

# Base directory for situations
SITUATIONS_DIR = Path(__file__).parent.parent / 'situations'


def get_project_path(project_id: str) -> Path:
    """Returns the path to a project directory."""
    return SITUATIONS_DIR / project_id


def get_tree_yaml_path(project_id: str) -> Path:
    """Returns the path to a project's tree.yaml file."""
    return get_project_path(project_id) / 'tree.yaml'


def load_situation(project_id: str) -> Situation:
    """Loads a situation from its tree.yaml file."""
    tree_path = get_tree_yaml_path(project_id)
    if not tree_path.exists():
        raise FileNotFoundError(f"Project {project_id} not found")
    
    with open(tree_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    return Situation.from_yaml(content)


def save_situation(project_id: str, situation: Situation) -> None:
    """Saves a situation to its tree.yaml file."""
    tree_path = get_tree_yaml_path(project_id)
    situation.save_to_file(str(tree_path))


@app.route('/')
def index():
    """Serve the main application page."""
    return send_from_directory('static', 'index.html')


@app.route('/project/<project_id>')
def project_view(project_id):
    """Serve the application page for a specific project."""
    return send_from_directory('static', 'index.html')


@app.route('/api/projects', methods=['GET'])
def list_projects():
    """List all available projects."""
    projects = []
    
    if not SITUATIONS_DIR.exists():
        return jsonify(projects)
    
    for project_dir in SITUATIONS_DIR.iterdir():
        if project_dir.is_dir():
            tree_path = project_dir / 'tree.yaml'
            if tree_path.exists():
                try:
                    situation = load_situation(project_dir.name)
                    projects.append({
                        'id': project_dir.name,
                        'name': situation.name,
                        'creator': situation.creator,
                        'summary': situation.summary,
                        'created_at': situation.created_at.isoformat() if isinstance(situation.created_at, datetime) else str(situation.created_at),
                        'updated_at': situation.updated_at.isoformat() if isinstance(situation.updated_at, datetime) else str(situation.updated_at)
                    })
                except Exception as e:
                    print(f"Error loading project {project_dir.name}: {e}")
    
    return jsonify(projects)


@app.route('/api/projects/<project_id>', methods=['GET'])
def get_project(project_id):
    """Get a specific project with all its data."""
    try:
        situation = load_situation(project_id)
        return jsonify({
            'id': project_id,
            'name': situation.name,
            'creator': situation.creator,
            'summary': situation.summary,
            'created_at': situation.created_at.isoformat() if isinstance(situation.created_at, datetime) else str(situation.created_at),
            'updated_at': situation.updated_at.isoformat() if isinstance(situation.updated_at, datetime) else str(situation.updated_at),
            'options': situation.options,
            'observations': [
                {
                    'id': obs.id,
                    'caused_by': obs.caused_by,
                    'summary': obs.summary,
                    'description': obs.description,
                    'attachments': obs.attachments,
                    'comments': obs.comments,
                    'solution': obs.solution or ""
                }
                for obs in situation.tree
            ]
        })
    except FileNotFoundError:
        return jsonify({'error': 'Project not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/projects', methods=['POST'])
def create_project():
    """Create a new project."""
    data = request.json
    
    # Generate a project ID from the name
    name = data.get('name', 'New Situation')
    creator = data.get('creator', 'Anonymous')
    summary = data.get('summary', '')
    
    # Create a simple ID from the name
    project_id = name.lower().replace(' ', '_').replace('/', '_')
    
    # Ensure unique ID
    counter = 1
    original_id = project_id
    while get_project_path(project_id).exists():
        project_id = f"{original_id}_{counter}"
        counter += 1
    
    # Create directory
    project_path = get_project_path(project_id)
    project_path.mkdir(parents=True, exist_ok=True)
    
    # Create situation
    now = datetime.now()
    situation = Situation(
        name=name,
        creator=creator,
        summary=summary,
        created_at=now,
        updated_at=now,
        options={},
        tree=[]
    )
    
    # Save to file
    save_situation(project_id, situation)
    
    return jsonify({
        'id': project_id,
        'name': situation.name,
        'creator': situation.creator,
        'summary': situation.summary,
        'created_at': situation.created_at.isoformat(),
        'updated_at': situation.updated_at.isoformat()
    }), 201


@app.route('/api/projects/<project_id>', methods=['PUT'])
def update_project(project_id):
    """Update project metadata."""
    try:
        situation = load_situation(project_id)
        data = request.json
        
        if 'name' in data:
            situation.name = data['name']
        if 'creator' in data:
            situation.creator = data['creator']
        if 'summary' in data:
            situation.summary = data['summary']
        
        situation.updated_at = datetime.now()
        save_situation(project_id, situation)
        
        return jsonify({'success': True})
    except FileNotFoundError:
        return jsonify({'error': 'Project not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/projects/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    """Delete a project."""
    try:
        import shutil
        project_path = get_project_path(project_id)
        if project_path.exists():
            shutil.rmtree(project_path)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/projects/<project_id>/observations', methods=['POST'])
def create_observation(project_id):
    """Create a new observation."""
    try:
        situation = load_situation(project_id)
        data = request.json
        
        summary = data.get('summary', 'New Observation')
        description = data.get('description', '')
        
        new_obs = situation.add_observation(summary, description)
        save_situation(project_id, situation)
        
        return jsonify({
            'id': new_obs.id,
            'caused_by': new_obs.caused_by,
            'summary': new_obs.summary,
            'description': new_obs.description,
            'attachments': new_obs.attachments,
            'comments': new_obs.comments,
            'solution': new_obs.solution or ""
        }), 201
    except FileNotFoundError:
        return jsonify({'error': 'Project not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/projects/<project_id>/observations/<int:obs_id>', methods=['PUT'])
def update_observation(project_id, obs_id):
    """Update an observation."""
    try:
        situation = load_situation(project_id)
        obs = situation.get_observation(obs_id)
        
        if not obs:
            return jsonify({'error': 'Observation not found'}), 404
        
        data = request.json
        
        if 'summary' in data:
            obs.summary = data['summary']
        if 'description' in data:
            obs.description = data['description']
        if 'attachments' in data:
            obs.attachments = data['attachments']
        if 'comments' in data:
            obs.comments = data['comments']
        if 'solution' in data:
            obs.solution = data['solution']
        
        situation.updated_at = datetime.now()
        save_situation(project_id, situation)
        
        return jsonify({'success': True})
    except FileNotFoundError:
        return jsonify({'error': 'Project not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/projects/<project_id>/observations/<int:obs_id>', methods=['DELETE'])
def delete_observation(project_id, obs_id):
    """Delete an observation."""
    try:
        situation = load_situation(project_id)
        data = request.json or {}
        mode = data.get('mode', 'break')
        
        if situation.is_intermediate_node(obs_id) and mode not in ['break', 'stretch']:
            return jsonify({
                'error': 'intermediate_node',
                'message': 'This observation is intermediate. Please specify mode as "break" or "stretch".'
            }), 400
        
        situation.delete_observation(obs_id, mode)
        save_situation(project_id, situation)
        
        return jsonify({'success': True})
    except FileNotFoundError:
        return jsonify({'error': 'Project not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/projects/<project_id>/links', methods=['POST'])
def create_link(project_id):
    """Create a link between two observations."""
    try:
        situation = load_situation(project_id)
        data = request.json
        
        from_id = data.get('from_id')
        to_id = data.get('to_id')
        
        if not from_id or not to_id:
            return jsonify({'error': 'from_id and to_id are required'}), 400
        
        success = situation.create_link(from_id, to_id)
        
        if not success:
            return jsonify({'error': 'Observations not found'}), 404
        
        save_situation(project_id, situation)
        
        return jsonify({'success': True}), 201
    except FileNotFoundError:
        return jsonify({'error': 'Project not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/projects/<project_id>/links', methods=['DELETE'])
def delete_link(project_id):
    """Delete a link between two observations."""
    try:
        situation = load_situation(project_id)
        data = request.json
        
        from_id = data.get('from_id')
        to_id = data.get('to_id')
        
        if not from_id or not to_id:
            return jsonify({'error': 'from_id and to_id are required'}), 400
        
        success = situation.delete_link(from_id, to_id)
        
        if not success:
            return jsonify({'error': 'Observations not found'}), 404
        
        save_situation(project_id, situation)
        
        return jsonify({'success': True})
    except FileNotFoundError:
        return jsonify({'error': 'Project not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/projects/<project_id>/attachments', methods=['POST'])
def upload_attachment(project_id):
    """Upload a file attachment."""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Save file to project directory
        project_path = get_project_path(project_id)
        file_path = project_path / file.filename
        file.save(str(file_path))
        
        return jsonify({
            'success': True,
            'filename': file.filename
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/projects/<project_id>/attachments/<filename>', methods=['GET'])
def get_attachment(project_id, filename):
    """Download a file attachment."""
    try:
        project_path = get_project_path(project_id)
        return send_from_directory(str(project_path), filename)
    except Exception as e:
        return jsonify({'error': str(e)}), 404


@app.route('/api/projects/<project_id>/attachments/<filename>', methods=['DELETE'])
def delete_attachment(project_id, filename):
    """Delete a file attachment."""
    try:
        project_path = get_project_path(project_id)
        file_path = project_path / filename
        
        if file_path.exists():
            file_path.unlink()
        
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print(f"Dissector Visual Tool Server")
    print(f"Situations directory: {SITUATIONS_DIR}")
    print(f"Starting server on http://localhost:5010")
    app.run(debug=True, port=5010)
