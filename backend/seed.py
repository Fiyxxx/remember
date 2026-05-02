"""
seed.py — write initial knowledge_graph.json with placeholder data.
Replace the descriptor list with a real 128-float face embedding before using
face recognition against this entry.
"""

import json
from pathlib import Path

KG_PATH = Path(__file__).parent / "knowledge_graph.json"

SEED_DATA = {
    "people": {
        "alex_chen": {
            "person_id": "alex_chen",
            "display_name": "Alex Chen",
            # Replace with a real 128-float face descriptor:
            "descriptor": [0.0] * 128,
            "topics": ["machine learning", "hiking"],
            "notes": "",
            "last_seen": None,
        }
    },
    "agenda": [
        {"id": 1, "text": "Demo face recognition to judges", "done": False},
        {"id": 2, "text": "Integrate Gemini knowledge graph updates", "done": False},
        {"id": 3, "text": "Test speech transcription accuracy", "done": False},
        {"id": 4, "text": "Polish overlay UI before final presentation", "done": False},
    ],
}

if __name__ == "__main__":
    with open(KG_PATH, "w") as f:
        json.dump(SEED_DATA, f, indent=2)
    print(f"Seeded {KG_PATH}")
