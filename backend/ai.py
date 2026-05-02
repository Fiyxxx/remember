import google.generativeai as genai
import json
import os
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel("gemini-2.0-flash-exp")


def _parse_json_response(text: str):
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


def extract_new_facts(person: dict, transcript: str) -> dict | None:
    prompt = f"""You are updating a personal knowledge base about someone.

Current knowledge about this person:
- Name: {person['display_name']}
- Known topics: {', '.join(person['topics']) if person['topics'] else 'none'}
- Notes: {person['notes'] or 'none'}

They just said: "{transcript}"

Extract any NEW facts worth remembering (interests, plans, opinions, important info).
If nothing new was said, return null.

Return ONLY valid JSON in this format or null:
{{
  "new_topics": ["topic1", "topic2"],
  "notes_addition": "one sentence of new info"
}}"""
    response = model.generate_content(prompt)
    text = response.text.strip()

    if text.lower() == "null" or not text:
        return None

    try:
        return _parse_json_response(text)
    except (json.JSONDecodeError, IndexError):
        return None


def generate_query_response(query: str, knowledge_graph: dict) -> dict:
    kg_summary = json.dumps(knowledge_graph, indent=2)

    prompt = f"""You are a personal AI assistant with access to the user's knowledge graph.

Knowledge graph:
{kg_summary}

User asked: "{query}"

Respond helpfully and concisely.

If the user is asking about their agenda, tasks, or schedule, return a checklist.
Otherwise, return just an answer.

Return ONLY valid JSON:
{{
  "answer": "your natural language answer",
  "checklist": ["item 1", "item 2"]
}}"""
    response = model.generate_content(prompt)
    text = response.text.strip()

    try:
        return _parse_json_response(text)
    except (json.JSONDecodeError, IndexError):
        return {"answer": text, "checklist": []}
