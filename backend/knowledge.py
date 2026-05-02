import json
from pathlib import Path

KG_PATH = Path(__file__).parent / "knowledge_graph.json"


def load_kg() -> dict:
    raise NotImplementedError


def save_kg(kg: dict) -> None:
    raise NotImplementedError


def get_person(kg: dict, person_id: str) -> dict | None:
    raise NotImplementedError


def update_person(kg: dict, person_id: str, updates: dict) -> dict:
    raise NotImplementedError


def introduce_person(kg: dict, temp_id: str, name: str, descriptor: list[float]) -> dict:
    raise NotImplementedError
