"""
seed.py — reset knowledge_graph.json to clean demo state.
Run: python seed.py
"""

import json
from pathlib import Path

KG_PATH = Path(__file__).parent / "knowledge_graph.json"

SEED_DATA = {
    "people": {},
    "agenda": [
        "10:00am — Demo face recognition to judges",
        "2:00pm — Final integration test with teammate",
        "Submit project to Replit by 6:00pm",
        "Write project description on Devpost"
    ]
}

if __name__ == "__main__":
    with open(KG_PATH, "w") as f:
        json.dump(SEED_DATA, f, indent=2)
    print(f"Seeded {KG_PATH}")
    print(f"  Agenda items: {len(SEED_DATA['agenda'])}")
