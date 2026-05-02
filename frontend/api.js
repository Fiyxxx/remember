const BACKEND_URL = "http://localhost:8000";

// --- Mock responses (active while backend is not running) ---

export async function updatePerson(personId, transcript) {
  // Real implementation:
  // const res = await fetch(`${BACKEND_URL}/update-person`, {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ person_id: personId, transcript }),
  // });
  // return res.json();

  return { status: "ok" };
}

export async function introducePerson(tempId, name, descriptor) {
  // Real implementation:
  // const res = await fetch(`${BACKEND_URL}/introduce`, {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ temp_id: tempId, name, descriptor }),
  // });
  // return res.json();

  return { person_id: `mock_${tempId}` };
}

export async function queryAI(transcript) {
  // Real implementation:
  // const res = await fetch(`${BACKEND_URL}/query`, {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ transcript }),
  // });
  // return res.json();

  return { response: `[mock] You said: "${transcript}"` };
}

export async function fetchKnowledgeGraph() {
  // Real implementation:
  // const res = await fetch(`${BACKEND_URL}/knowledge-graph`);
  // return res.json();

  return { people: {}, agenda: [] };
}

export { BACKEND_URL };
