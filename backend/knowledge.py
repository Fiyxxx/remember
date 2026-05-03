import json
from pathlib import Path
from datetime import datetime

KG_PATH = Path(__file__).parent / "knowledge_graph.json"


def load_kg() -> dict:
    if not KG_PATH.exists():
        return {"people": {}, "agenda": []}
    with open(KG_PATH, "r") as f:
        return json.load(f)


def save_kg(kg: dict) -> None:
    with open(KG_PATH, "w") as f:
        json.dump(kg, f, indent=2)


def get_person(kg: dict, person_id: str) -> dict | None:
    return kg["people"].get(person_id)


def update_person(kg: dict, person_id: str, updates: dict) -> dict:
    if person_id not in kg["people"]:
        raise ValueError(f"Person {person_id} not found")
    kg["people"][person_id].update(updates)
    kg["people"][person_id]["last_seen"] = datetime.now().isoformat()
    save_kg(kg)
    return kg["people"][person_id]


def introduce_person(kg: dict, temp_id: str, name: str, descriptor: list[float]) -> tuple[str, dict]:
    person_id = name.lower().replace(" ", "_")
    new_person = {
        "descriptor": descriptor,
        "display_name": name,
        "topics": [],
        "first_met": datetime.now().strftime("%Y-%m-%d"),
        "last_seen": datetime.now().isoformat(),
        "notes": ""
    }
    if temp_id in kg["people"]:
        del kg["people"][temp_id]
    kg["people"][person_id] = new_person
    save_kg(kg)
    return person_id, new_person
