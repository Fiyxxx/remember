from openai import OpenAI
import json
import os
from dotenv import load_dotenv

load_dotenv(override=True)
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
MODEL = "gpt-4o-mini"


def _chat(prompt: str) -> str:
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )
    return response.choices[0].message.content


def extract_new_facts(person: dict, transcript: str) -> dict | None:
    prompt = f"""You are updating a personal knowledge base about someone.

Current knowledge about this person:
- Name: {person['display_name']}
- Relationship to user: {person.get('relationship') or 'unknown'}
- Known topics: {', '.join(person['topics']) if person['topics'] else 'none'}
- Notes: {person['notes'] or 'none'}

They just said: "{transcript}"

Extract any NEW facts worth remembering. Also check if they mention their relationship to the user (e.g. "I'm your brother", "we're colleagues", "I'm your manager"). Only extract relationship if explicitly stated.
If nothing new was said, return {{"result": null}}.

Return ONLY valid JSON in this format:
{{
  "result": {{
    "new_topics": ["topic1", "topic2"],
    "notes_addition": "one sentence of new info",
    "relationship": "brother"
  }}
}}

Omit any field that has no new value. relationship should be a short lowercase word or phrase (e.g. "brother", "close friend", "colleague", "manager")."""
    try:
        data = json.loads(_chat(prompt))
        result = data.get("result")
        return result if result else None
    except (json.JSONDecodeError, KeyError):
        return None


def generate_query_response(query: str, knowledge_graph: dict) -> dict:
    kg_summary = json.dumps(knowledge_graph, indent=2)

    prompt = f"""You are a personal AI assistant for a dementia patient, with access to their knowledge graph including their agenda.

Knowledge graph:
{kg_summary}

User asked: "{query}"

Respond helpfully and concisely.

You can manipulate the user's agenda. Use the "agenda_ops" field to describe changes:
- {{"op": "add", "item": "text"}} — add an item
- {{"op": "remove", "index": 0}} — remove item at index (0-based)
- {{"op": "replace", "index": 0, "item": "new text"}} — replace item at index
- {{"op": "clear"}} — remove all items

If the user asks to see/show their agenda, return the current items in "checklist".
If the user modifies the agenda (add/remove/replace/clear), apply the changes via agenda_ops AND return the updated list in "checklist".
If the query is unrelated to the agenda, leave both as empty arrays.

Return ONLY valid JSON:
{{
  "answer": "your natural language answer",
  "checklist": ["item 1", "item 2"],
  "agenda_ops": []
}}"""
    try:
        return json.loads(_chat(prompt))
    except (json.JSONDecodeError, KeyError):
        return {"answer": "Could not parse response.", "checklist": [], "agenda_ops": []}
