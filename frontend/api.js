import { LocalState } from "./state.js";

const BACKEND_URL = "http://localhost:8000";

export async function fetchKnowledgeGraph() {
  const res = await fetch(`${BACKEND_URL}/knowledge-graph`);
  if (!res.ok) throw new Error(`GET /knowledge-graph → ${res.status}`);
  return res.json();
}

// Returns: { person: <person object>, was_updated: boolean }
export async function updatePerson(personId, transcript) {
  const res = await fetch(`${BACKEND_URL}/update-person`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ person_id: personId, transcript }),
  });
  if (!res.ok) throw new Error(`POST /update-person → ${res.status}`);
  return res.json();
}

// Returns: { person_id: string, person: <person object> }
export async function introducePerson(tempId, name, descriptor) {
  const res = await fetch(`${BACKEND_URL}/introduce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ temp_id: tempId, name, descriptor: Array.from(descriptor) }),
  });
  if (!res.ok) throw new Error(`POST /introduce → ${res.status}`);
  return res.json();
}

// Returns: { answer: string, checklist: string[] }
export async function queryAI(transcript) {
  const res = await fetch(`${BACKEND_URL}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: transcript, knowledge_graph: LocalState.knowledgeGraph }),
  });
  if (!res.ok) throw new Error(`POST /query → ${res.status}`);
  return res.json();
}

export { BACKEND_URL };
