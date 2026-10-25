"""Grounded natural-language water advisory powered by Groq."""

import json

import httpx
from fastapi import APIRouter, HTTPException

from config import settings
from models.schemas import WaterAdvisoryRequest, WaterAdvisoryResponse

router = APIRouter()


@router.post("/water", response_model=WaterAdvisoryResponse)
async def water_advisory(payload: WaterAdvisoryRequest) -> WaterAdvisoryResponse:
    if not settings.GROQ_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="GROQ_API_KEY is not configured. Add it to backend/.env to enable the advisory.",
        )

    facts = payload.model_dump()
    system_prompt = (
        "You are WaterWallet's water-planning advisor. Explain the supplied, "
        "already-calculated facts for a housing society. Do not recalculate, "
        "invent values, or provide engineering guarantees. Return only valid "
        "JSON with exactly these keys: summary (string), recommendations "
        "(array of 2-4 concise strings), risks (array of 1-3 strings), and "
        "assumptions (array of 1-3 strings). Mention when a conclusion depends "
        "on the supplied assumptions. Keep language suitable for a society committee."
    )
    user_prompt = (
        f"Advisor focus: {payload.focus}\n"
        f"Validated WaterWallet metrics:\n{json.dumps(facts, indent=2)}"
    )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            models = [settings.GROQ_MODEL]
            if settings.GROQ_MODEL != "openai/gpt-oss-20b":
                models.append("openai/gpt-oss-20b")
            for model_index, model in enumerate(models):
                response = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "temperature": 0.2,
                        "response_format": {"type": "json_object"},
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                    },
                )
                if response.status_code != 404 or model_index == len(models) - 1:
                    break
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"]
            return WaterAdvisoryResponse.model_validate(json.loads(content))
    except (httpx.HTTPError, KeyError, IndexError, json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(
            status_code=502,
            detail="The AI advisory service did not return a valid advisory. Please try again.",
        ) from exc
