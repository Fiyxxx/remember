"""
seed.py — write initial knowledge_graph.json with placeholder data.
Replace the descriptor lists with real 128-float face embeddings before
using face recognition against these entries.
"""

import json
from pathlib import Path
from datetime import date

KG_PATH = Path(__file__).parent / "knowledge_graph.json"

TODAY = str(date.today())

SEED_DATA = {
    "people": {
        "Alex": {
            "descriptor": [0.0] * 128,
            "display_name": "Alex Chen",
            "topics": ["machine learning", "hiking"],
            "first_met": TODAY,
            "last_seen": TODAY + "T09:00:00",
            "notes": "Works on AI research, met at NUS"
        }
    },
    "agenda": [
        "10:00am — Recall hackathon demo prep",
        "2:00pm — Final integration test with teammate",
        "Submit project to Replit by 6:00pm",
        "Write project description on Devpost"
    ]
}

if __name__ == "__main__":
    with open(KG_PATH, "w") as f:
        json.dump(SEED_DATA, f, indent=2)
    print(f"Seeded {KG_PATH}")
    print(f"  People: {list(SEED_DATA['people'].keys())}")
    print(f"  Agenda items: {len(SEED_DATA['agenda'])}")
