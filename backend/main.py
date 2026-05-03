from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import knowledge as kg_module
import ai

app = FastAPI(title="Remember API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

kg = kg_module.load_kg()


class UpdatePersonRequest(BaseModel):
    person_id: str
    transcript: str


class IntroduceRequest(BaseModel):
    temp_id: str
    name: str
    descriptor: list[float]


class QueryRequest(BaseModel):
    query: str
    knowledge_graph: dict


@app.get("/knowledge-graph")
async def get_knowledge_graph():
    return kg


@app.post("/update-person")
async def update_person(req: UpdatePersonRequest):
    if len(req.transcript.split()) < 4:
        return {"person": None, "was_updated": False}

    person = kg_module.get_person(kg, req.person_id)
    if not person:
        raise HTTPException(status_code=404, detail=f"Person {req.person_id} not found")

    new_facts = ai.extract_new_facts(person, req.transcript)

    if new_facts is None:
        return {"person": person, "was_updated": False}

    updates = {}
    if new_facts.get("new_topics"):
        existing = set(person.get("topics", []))
        existing.update(new_facts["new_topics"])
        updates["topics"] = list(existing)
    if new_facts.get("notes_addition"):
        existing_notes = person.get("notes", "")
        updates["notes"] = (existing_notes + ". " + new_facts["notes_addition"]).strip(". ")
    if new_facts.get("relationship"):
        updates["relationship"] = new_facts["relationship"]

    updated = kg_module.update_person(kg, req.person_id, updates)
    return {"person": updated, "was_updated": True}


@app.post("/introduce")
async def introduce(req: IntroduceRequest):
    if len(req.descriptor) != 128:
        raise HTTPException(status_code=400, detail="Descriptor must be exactly 128 floats")

    person_id, person = kg_module.introduce_person(kg, req.temp_id, req.name, req.descriptor)
    return {"person_id": person_id, "person": person}


@app.post("/query")
async def query(req: QueryRequest):
    result = ai.generate_query_response(req.query, kg)

    agenda_ops = result.pop("agenda_ops", [])
    if agenda_ops:
        for op_entry in agenda_ops:
            op = op_entry.get("op")
            if op == "add" and "item" in op_entry:
                kg["agenda"].append(op_entry["item"])
            elif op == "remove" and "index" in op_entry:
                idx = op_entry["index"]
                if 0 <= idx < len(kg["agenda"]):
                    kg["agenda"].pop(idx)
            elif op == "replace" and "index" in op_entry and "item" in op_entry:
                idx = op_entry["index"]
                if 0 <= idx < len(kg["agenda"]):
                    kg["agenda"][idx] = op_entry["item"]
            elif op == "clear":
                kg["agenda"] = []
        kg_module.save_kg(kg)
        result["checklist"] = list(kg["agenda"])

    return result


@app.delete("/admin/person/{person_id}")
async def admin_delete_person(person_id: str):
    if person_id not in kg["people"]:
        raise HTTPException(status_code=404, detail="Person not found")
    del kg["people"][person_id]
    kg_module.save_kg(kg)
    return {"ok": True}


@app.post("/admin/reset")
async def admin_reset():
    kg["people"] = {}
    kg_module.save_kg(kg)
    return {"ok": True}
