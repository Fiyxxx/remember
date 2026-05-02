import { LocalState } from "./state.js";

const BACKEND_URL = "http://localhost:8000";

// Set to false when your teammate's backend is running
const MOCKS_ACTIVE = true;

export async function fetchKnowledgeGraph() {
  if (MOCKS_ACTIVE) {
    return {
      people: {
        han_sheng: {
          descriptor: [], // replaced by real descriptor after enrollment
          display_name: "Han Sheng",
          topics: [],
          first_met: "2026-05-03",
          last_seen: null,
          notes: "",
        },
      },
      agenda: [
        "10:00am — Demo face recognition to judges",
        "2:00pm — Integrate Gemini knowledge graph",
        "Send Q2 report by EOD",
        "Polish overlay UI before presentation",
      ],
    };
  }
  const res = await fetch(`${BACKEND_URL}/knowledge-graph`);
  if (!res.ok) throw new Error(`GET /knowledge-graph → ${res.status}`);
  return res.json();
}

// Called when speech pauses and a known person is in frame
// Returns: { person: <person object>, was_updated: boolean }
export async function updatePerson(personId, transcript) {
  if (MOCKS_ACTIVE) {
    return {
      person: LocalState.knowledgeGraph.people[personId] ?? null,
      was_updated: false,
    };
  }
  const res = await fetch(`${BACKEND_URL}/update-person`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ person_id: personId, transcript }),
  });
  if (!res.ok) throw new Error(`POST /update-person → ${res.status}`);
  return res.json();
}

// Called when unknown person introduces themselves ("Hi I'm Sarah")
// Returns: { person_id: string, person: <person object> }
export async function introducePerson(tempId, name, descriptor) {
  if (MOCKS_ACTIVE) {
    const person_id = name.toLowerCase().replace(/\s+/g, "_");
    return {
      person_id,
      person: {
        descriptor: Array.from(descriptor),
        display_name: name,
        topics: [],
        first_met: new Date().toISOString().slice(0, 10),
        last_seen: new Date().toISOString(),
        notes: "",
      },
    };
  }
  const res = await fetch(`${BACKEND_URL}/introduce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ temp_id: tempId, name, descriptor: Array.from(descriptor) }),
  });
  if (!res.ok) throw new Error(`POST /introduce → ${res.status}`);
  return res.json();
}

// Called when user presses AI button and speaks a question
// Returns: { answer: string, checklist: string[] }
export async function queryAI(transcript) {
  if (MOCKS_ACTIVE) {
    return {
      answer: `[mock] You asked: "${transcript}"`,
      checklist: transcript.toLowerCase().includes("agenda")
        ? LocalState.knowledgeGraph.agenda
        : [],
    };
  }
  const res = await fetch(`${BACKEND_URL}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: transcript, knowledge_graph: LocalState.knowledgeGraph }),
  });
  if (!res.ok) throw new Error(`POST /query → ${res.status}`);
  return res.json();
}

export { BACKEND_URL };
