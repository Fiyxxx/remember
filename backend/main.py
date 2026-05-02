from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
from pathlib import Path

import knowledge  # noqa: F401 — imported for contract; not yet implemented
import ai  # noqa: F401 — imported for contract; not yet implemented

app = FastAPI(title="Remember API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

KG_PATH = Path(__file__).parent / "knowledge_graph.json"


class UpdatePersonRequest(BaseModel):
    person_id: str
    transcript: str


class IntroduceRequest(BaseModel):
    temp_id: str
    name: str
    descriptor: list[float]


class QueryRequest(BaseModel):
    transcript: str


@app.get("/knowledge-graph")
async def get_knowledge_graph():
    if KG_PATH.exists():
        with open(KG_PATH) as f:
            return json.load(f)
    return {"people": {}, "agenda": []}


@app.post("/update-person")
async def update_person(req: UpdatePersonRequest):
    # TODO: call knowledge.load_kg(), ai.extract_new_facts(), knowledge.update_person(), knowledge.save_kg()
    return {"status": "ok"}


@app.post("/introduce")
async def introduce(req: IntroduceRequest):
    # TODO: call knowledge.load_kg(), knowledge.introduce_person(), knowledge.save_kg()
    return {"person_id": f"pending_{req.temp_id}"}


@app.post("/query")
async def query(req: QueryRequest):
    # TODO: call knowledge.load_kg(), ai.generate_query_response()
    return {"response": "Not yet implemented"}
