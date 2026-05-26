from datetime import datetime, timedelta
from typing import AsyncGenerator, Optional

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="shipX AI Service")


# -----------------------------
# Models
# -----------------------------
class ValidateLocationRequest(BaseModel):
    address: str
    city: str | None = None
    country: str | None = None


class PredictEtaRequest(BaseModel):
    origin: dict
    destination: dict
    delayHistory: list[dict] = Field(default_factory=list)


class FraudRequest(BaseModel):
    trackingNumber: str
    history: list[dict]


class TrackingInsightsRequest(BaseModel):
    shipment: dict


class RecommendRequest(BaseModel):
    origin: dict
    destination: dict
    companyId: str | None = None


class ChatRequest(BaseModel):
    message: str
    trackingNumber: str | None = None
    companyId: str | None = None
    role: str | None = None
    context: Optional[dict] = None


class ExecuteRequest(BaseModel):
    actionType: str
    payload: dict = Field(default_factory=dict)


class ChatContext(BaseModel):
    role: str
    companyId: Optional[str] = None
    trackingNumber: Optional[str] = None
    # best-effort structured context injected by backend
    shipment: Optional[dict] = None
    warehouse: Optional[dict] = None
    analytics: Optional[dict] = None
    fraud: Optional[dict] = None
    recommendations: Optional[dict] = None


# -----------------------------
# LLM provider (OpenAI primary, Gemini fallback)
# -----------------------------


def _env(name: str, default: Optional[str] = None) -> str:
    import os

    v = os.getenv(name)
    if v is None or v == "":
        return default
    return v


def build_system_prompt() -> str:
    return (
        "You are shipX AI, a project-trained logistics assistant for the shipX AI Logistics web app. "
        "You help customers, admins, and warehouse managers with tracking, shipment creation, route status, "
        "delay reasons, weather impact, ETA, transport mode, fraud risk, warehouse assignment, pickups, account setup, "
        "dashboard navigation, and general logistics questions. "
        "You must be accurate, concise, friendly, and practical. Answer in the same language as the user when possible; "
        "Hinglish/Hindi is allowed when the user uses it. Use the provided structured context first. "
        "If tracking data is missing, ask for a tracking number instead of inventing parcel status. "
        "\\n\\nRules:\\n"
        "- Prefer factual statements based on context.\\n"
        "- If you estimate dates, delivery time, route progress, weather, or delays, label them as AI estimates.\\n"
        "- If fraud is flagged, explain risk factors and recommend safe next steps.\\n"
        "- Do not invent tracking events that are not present in shipment history.\\n"
        "- Do not ask for passwords, API keys, PAN/GST numbers, card details, or private documents in chat.\\n"
        "- For account opening, send users to Register/Open account.\\n"
        "- For customers: explain where the parcel is, why it may be delayed, ETA, mode, weather, and next step.\\n"
        "- For admins: explain dashboard actions, shipment creation, warehouse assignment, fraud checks, and live tracking automation.\\n"
        "\\nProject pages/features you know:\\n"
        "- Home has Tracking, Shipping, Support, and Account navigation.\\n"
        "- Tracking page accepts a tracking number and shows route, current location, transport mode, weather, delay reason, ETA confidence, map, and timeline.\\n"
        "- Register page creates a shipX account/workspace.\\n"
        "- Login page authenticates customers/admins.\\n"
        "- Customer dashboard shows shipment history, notifications, analytics, and chat.\\n"
        "- Admin dashboard manages shipments, analytics, fraud alerts, recommendations, and shipment creation.\\n"
        "- Warehouses page manages warehouses and assignment.\\n"
        "- The app can auto-update shipments with AI route scans and Socket.io live updates.\\n"
        "\\nFormat your response as short paragraphs or clear bullets. Keep answers useful, not overly long."
    )



def _messages_for_chat(req_message: str, context: Optional[ChatContext]) -> list[dict]:
    ctx_obj = context.model_dump() if context else None
    user_context = ""
    if ctx_obj:
        # Keep payload small; backend should already provide best-effort
        user_context = f"\nStructured context (JSON):\n{ctx_obj}\n"

    return [
        {"role": "system", "content": build_system_prompt()},
        {
            "role": "user",
            "content": f"User message: {req_message}{user_context}".strip(),
        },
    ]


def project_fallback_answer(message: str, context: Optional[ChatContext]) -> str:
    text = str(message or "").lower()
    ctx = context.model_dump() if context else {}
    shipment = ctx.get("shipment") or {}
    insights = shipment.get("aiInsights") or (build_tracking_insights(shipment) if shipment else None)
    tracking_number = ctx.get("trackingNumber") or shipment.get("trackingNumber")
    role = (ctx.get("role") or "customer").lower()
    lookup = ((ctx.get("recommendations") or {}).get("lookup") or {})

    if shipment and any(word in text for word in ["where", "track", "parcel", "package", "status", "kaha", "kidhar"]):
        location = compact_location(shipment.get("currentLocation"), "current hub")
        eta = shipment.get("estimatedDelivery") or "pending"
        delay = (insights or {}).get("delay") or {}
        mode = (insights or {}).get("transportMode") or {}
        weather = (insights or {}).get("weather") or {}
        return (
            f"Shipment {tracking_number} abhi {shipment.get('status', 'active')} hai.\n"
            f"- Current location: {location}\n"
            f"- Route: {(insights or {}).get('routeSummary', 'route data pending')}\n"
            f"- Transport mode: {mode.get('label', 'AI estimating')}\n"
            f"- Weather: {weather.get('label', 'Pending')} {weather.get('temp', '')}C\n"
            f"- ETA: {eta} ({(insights or {}).get('etaConfidence', 'AI')}% confidence)\n"
            f"- Delay: {delay.get('reason', 'No active delay signal found.')}"
        )

    if "delay" in text or "late" in text or "der" in text:
        if shipment and insights:
            delay = insights.get("delay") or {}
            return f"AI delay check: {delay.get('severity', 'None')} risk. Reason: {delay.get('reason', 'No active delay signal found.')}"
        return "Delay check ke liye tracking number bhejiye. Main route history, weather, hub scans, ETA window aur current location dekh kar reason bata dunga."

    if "weather" in text or "mausam" in text:
        if insights:
            weather = insights.get("weather") or {}
            return f"Current route weather AI estimate: {weather.get('label', 'Pending')} {weather.get('temp', '')}C at {weather.get('location', 'current hub')}. {weather.get('detail', '')}"
        return "Weather impact batane ke liye tracking number chahiye, kyunki weather parcel ke current hub/location par depend karta hai."

    if "eta" in text or "delivery" in text or "kab" in text or "time" in text:
        if shipment and insights:
            return f"Estimated delivery: {shipment.get('estimatedDelivery') or 'pending'}. AI confidence: {insights.get('etaConfidence', 'pending')}%. {insights.get('aiSummary', '')}"
        return "Delivery time check karne ke liye tracking number dijiye. Main ETA, confidence, delay reason aur current route status bata dunga."

    if "register" in text or "account" in text or "open" in text or "signup" in text:
        return "Account banane ke liye Register/Open account page par jaiye. Wahan company details, user info aur login credentials create honge. Existing user ho to Login page use karein."

    if "admin" in text or "dashboard" in text:
        if role in ["admin", "warehouse_manager"]:
            return "Admin dashboard me aap shipments create/update kar sakte hain, fraud alerts dekh sakte hain, AI recommendations, analytics, warehouses aur live tracking automation manage kar sakte hain."
        return "Dashboard role ke hisaab se open hota hai. Customer ko shipment history/notifications milte hain; admin ko shipment management, analytics, fraud alerts aur warehouse tools milte hain."

    if "warehouse" in text or "assign" in text:
        return "Warehouse assignment ke liye admin/warehouse manager Warehouses page par shipment tracking number select karke warehouse assign kar sakta hai. AI auto-tracker assignment ke baad live route updates bhejta rahega."

    if "fraud" in text or "risk" in text:
        fraud = shipment.get("fraud") or {}
        if shipment and fraud.get("isFlagged"):
            alerts = "; ".join(fraud.get("alerts") or ["Suspicious pattern detected"])
            return f"Fraud risk flagged for {tracking_number}. Risk score: {fraud.get('riskScore', 0)}. Reason: {alerts}. Admin should verify customer/address and avoid manual delivery override."
        return "Fraud check shipment history, repeated delays, unusual tracking pattern aur fake tracking prefix signals se hota hai. Specific parcel ke liye tracking number bhejiye."

    if tracking_number and not shipment:
        tried = lookup.get("tried") or []
        suggested = lookup.get("suggestedTracking")
        tried_text = f" Maine {', '.join(tried[:3])} formats bhi check kiye." if tried else ""
        suggestion_text = f" Abhi active shipment ke liye {suggested} try kar sakte hain." if suggested else ""
        return (
            f"{tracking_number} ka exact shipment record abhi nahi mila.{tried_text} "
            "Ho sakta hai number incomplete ho; shipX tracking usually SX-8042 ya SX-604547 jaisa hota hai. "
            f"Please full tracking number bhejiye, ya Tracking page par paste karke check kijiye.{suggestion_text}"
        )

    return (
        "Main shipX AI assistant hoon. Aap tracking number bhej kar parcel location, delay reason, weather, transport mode, ETA, timeline aur delivery status pooch sakte hain. "
        "Admin ho to shipment creation, warehouse assignment, fraud alerts, analytics aur dashboard actions ke baare me bhi pooch sakte hain."
    )


async def stream_openai_chat(messages: list[dict], model: str) -> AsyncGenerator[str, None]:
    """Streams tokens as they arrive from OpenAI."""
    from openai import AsyncOpenAI

    api_key = _env("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set")

    client = AsyncOpenAI(api_key=api_key)

    # We request delta streaming
    stream = await client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.2,
        stream=True,
    )

    async for event in stream:
        delta = getattr(event, "choices", [None])[0]
        delta = getattr(delta, "delta", None)
        if delta:
            text = getattr(delta, "content", None)
            if text:
                yield text


async def stream_gemini_chat(messages: list[dict], model: str) -> AsyncGenerator[str, None]:
    """Streams tokens from Gemini."""
    # google-genai is the modern SDK. We'll fallback gracefully.
    from google import genai

    api_key = _env("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")

    client = genai.Client(api_key=api_key)

    # Convert OpenAI-like messages to Gemini parts
    system = ""
    contents = []
    for m in messages:
        if m.get("role") == "system":
            system = m.get("content", "")
        else:
            contents.append(m.get("content", ""))

    prompt = "\n".join([f"{c}" for c in contents if c])

    # Gemini streaming
    stream = client.models.generate_content_stream(
        model=model,
        contents=prompt,
        config={"temperature": 0.2, "system_instruction": system},
    )

    for chunk in stream:
        # chunk.text typically contains incremental output
        text = getattr(chunk, "text", None)
        if text:
            yield text


async def stream_llm(messages: list[dict]) -> AsyncGenerator[str, None]:
    provider = (_env("AI_PROVIDER", "openai") or "openai").lower()
    openai_model = _env("OPENAI_MODEL", "gpt-4o-mini")
    gemini_model = _env("GEMINI_MODEL", "gemini-2.5-flash")

    last_err: Optional[Exception] = None

    async def try_openai():
        return stream_openai_chat(messages=messages, model=openai_model)

    async def try_gemini():
        return stream_gemini_chat(messages=messages, model=gemini_model)

    # order: provider first, fallback to other
    providers = ["openai", "gemini"]
    if provider in ("openai", "gemini"):
        providers = [provider, "gemini" if provider == "openai" else "openai"]

    for p in providers:
        try:
            if p == "openai":
                async for t in await try_openai():
                    yield t
                return
            if p == "gemini":
                async for t in await try_gemini():
                    yield t
                return
        except Exception as e:
            last_err = e

    raise RuntimeError(f"LLM streaming failed. Last error: {last_err}")


async def generate_llm(messages: list[dict]) -> str:
    """Non-streaming generation using the same providers."""
    # Implement by streaming and joining (simple + consistent)
    out = []
    async for t in stream_llm(messages):
        out.append(t)
    return "".join(out)


# -----------------------------
# Utilities: placeholder domain logic (existing)
# -----------------------------
from geopy.distance import geodesic


def compute_distance(origin: dict, destination: dict) -> float:
    try:
        a = tuple(origin.get("coordinates", [])[:2])
        b = tuple(destination.get("coordinates", [])[:2])
        if len(a) == 2 and len(b) == 2 and all(isinstance(x, (int, float)) for x in a + b):
            return geodesic((a[1], a[0]), (b[1], b[0])).kilometers
    except Exception:
        pass
    return 0.0


def compact_location(location: Optional[dict], fallback: str = "-") -> str:
    if not location:
        return fallback
    return (
        location.get("text")
        or ", ".join([v for v in [location.get("city"), location.get("country")] if v])
        or fallback
    )


def text_hash(value: str) -> int:
    return sum(ord(ch) for ch in str(value or ""))


def progress_for_shipment(shipment: dict) -> int:
    for entry in reversed(shipment.get("history") or []):
        try:
            progress = float((entry.get("meta") or {}).get("autoProgress"))
            return max(0, min(100, round(progress)))
        except Exception:
            pass

    status = str(shipment.get("status") or "").lower()
    if status == "delivered":
        return 100
    if status == "out for delivery":
        return 88
    if status == "arrived":
        return 70
    if status == "in transit":
        return 42
    return 8


def tracking_weather(shipment: dict) -> dict:
    current = compact_location(shipment.get("currentLocation"), compact_location(shipment.get("destination"), "current hub"))
    options = [
        {"label": "Clear", "icon": "SUN", "detail": "Good visibility, no route weather delay expected", "temp": 29},
        {"label": "Cloudy", "icon": "CLD", "detail": "Normal movement conditions around this hub", "temp": 24},
        {"label": "Rain", "icon": "RAIN", "detail": "Wet roads can slow pickup or handoff by 1-3 hours", "temp": 22},
        {"label": "Hot", "icon": "HOT", "detail": "Heat-sensitive parcels may need extra handling care", "temp": 34},
    ]
    item = dict(options[text_hash(current) % len(options)])
    item["location"] = current
    item["temp"] = item["temp"] + (text_hash(current) % 4)
    return item


def tracking_mode(shipment: dict, progress: int) -> dict:
    route_text = f"{compact_location(shipment.get('origin'), '')} {compact_location(shipment.get('destination'), '')}".lower()
    if progress >= 86:
        return {"key": "bike", "label": "Bike", "icon": "BIKE", "detail": "Last-mile delivery near customer address"}
    if "airport" in route_text or "international" in route_text or progress < 36:
        return {"key": "plane", "label": "Air freight", "icon": "AIR", "detail": "Fast hub-to-hub movement selected by AI"}
    if "rail" in route_text or progress < 64:
        return {"key": "train", "label": "Rail line haul", "icon": "RAIL", "detail": "Regional hub transfer with lower delay risk"}
    return {"key": "truck", "label": "Truck", "icon": "TRUCK", "detail": "Road transport toward destination city"}


def tracking_delay(shipment: dict, progress: int, weather: dict) -> dict:
    eta_raw = shipment.get("estimatedDelivery")
    is_late = False
    if eta_raw and str(shipment.get("status")) != "Delivered":
        try:
            eta = datetime.fromisoformat(str(eta_raw).replace("Z", "+00:00"))
            is_late = eta.replace(tzinfo=None) < datetime.utcnow()
        except Exception:
            is_late = False

    delayed_history = len([
        entry for entry in (shipment.get("history") or [])
        if "delay" in str(entry.get("status") or "").lower()
    ])
    weather_risk = weather.get("label") in ["Rain", "Hot"]

    if is_late:
        return {"isDelayed": True, "severity": "High", "reason": "Estimated delivery window has passed; AI recommends hub escalation."}
    if delayed_history:
        return {"isDelayed": True, "severity": "Medium", "reason": "Previous delay scans found in shipment timeline."}
    if weather_risk and progress < 95:
        return {"isDelayed": True, "severity": "Low", "reason": f"{weather.get('label')} near {weather.get('location')} may slow the next handoff."}
    if progress < 20:
        return {"isDelayed": False, "severity": "None", "reason": "Parcel is in the first scan window; no delay detected yet."}
    return {"isDelayed": False, "severity": "None", "reason": "AI found normal route movement and no active delay signal."}


def build_tracking_insights(shipment: dict) -> dict:
    progress = progress_for_shipment(shipment)
    weather = tracking_weather(shipment)
    delay = tracking_delay(shipment, progress, weather)
    mode = tracking_mode(shipment, progress)
    origin = compact_location(shipment.get("origin"), "origin hub")
    destination = compact_location(shipment.get("destination"), "destination")
    current = compact_location(shipment.get("currentLocation"), "current hub")
    base_confidence = 94 if progress >= 86 else 88 if progress >= 60 else 80 if progress >= 25 else 72
    confidence = max(45, base_confidence - (12 if delay.get("isDelayed") else 0))

    timeline = []
    for entry in list(shipment.get("history") or [])[-8:][::-1]:
        meta = entry.get("meta") or {}
        timeline.append({
            "status": entry.get("status") or "Update",
            "at": entry.get("at") or entry.get("timestamp") or meta.get("autoUpdatedAt") or meta.get("statusUpdatedAt"),
            "location": entry.get("location"),
            "progressPercent": round(meta.get("autoProgress")) if isinstance(meta.get("autoProgress"), (int, float)) else None,
            "detail": "AI auto scan updated this route checkpoint." if meta.get("autoTracked") else "Manual or system scan recorded for this parcel.",
        })

    if not timeline:
        timeline.append({
            "status": shipment.get("status") or "Created",
            "at": shipment.get("updatedAt"),
            "location": shipment.get("currentLocation") or shipment.get("origin"),
            "progressPercent": progress,
            "detail": "AI is waiting for the next parcel scan.",
        })

    return {
        "progressPercent": progress,
        "routeSummary": f"{origin} -> {destination}",
        "currentLocationText": current,
        "transportMode": mode,
        "weather": weather,
        "delay": delay,
        "etaConfidence": confidence,
        "estimatedDelivery": shipment.get("estimatedDelivery"),
        "timeline": timeline,
        "aiSummary": f"AI detected a {delay.get('severity', '').lower()} delay risk: {delay.get('reason')}" if delay.get("isDelayed") else f"AI detects normal movement from {origin} toward {destination}.",
    }


# -----------------------------
# Domain endpoints
# -----------------------------
@app.get("/health")
def health():
    return {"ok": True}


@app.post("/validate-location")
def validate_location(req: ValidateLocationRequest):
    normalized_address = req.address.strip()
    confidence = 0.65 if normalized_address else 0.0
    return {
        "normalized": {
            "address": normalized_address,
            "city": (req.city or "").strip(),
            "country": (req.country or "").strip(),
        },
        "confidence": confidence,
        "validated": bool(normalized_address),
    }


@app.post("/predict-eta")
def predict_eta(req: PredictEtaRequest):
    distance = compute_distance(req.origin, req.destination)
    base_hours = max(distance / 60.0, 4)
    delay_penalty = len(req.delayHistory) * 6
    eta_days = round((base_hours + delay_penalty) / 24, 1)
    estimated_delivery = (datetime.utcnow() + timedelta(days=eta_days)).date().isoformat()
    risk = min(1.0, 0.1 + len(req.delayHistory) * 0.05 + (distance / 1500.0))

    return {
        "estimatedDelivery": estimated_delivery,
        "etaDays": eta_days,
        "risk": round(risk, 2),
    }


@app.post("/detect-fraud")
def detect_fraud(req: FraudRequest):
    history_count = len(req.history or [])
    repeated_statuses = len([entry for entry in req.history if entry.get("status") == "Delayed"])
    risk_score = min(1.0, 0.05 + (history_count * 0.03) + (repeated_statuses * 0.1))
    is_fraud = risk_score >= 0.25 or req.trackingNumber.upper().startswith("SX-FAKE")
    alerts = []
    if is_fraud:
        alerts.append("Potential fraud detected based on delay frequency and unusual pattern.")
    return {"fraud": is_fraud, "riskScore": round(risk_score, 2), "alerts": alerts}


@app.post("/tracking-insights")
def tracking_insights(req: TrackingInsightsRequest):
    return build_tracking_insights(req.shipment or {})


@app.post("/recommend")
def recommend(req: RecommendRequest):
    origin = req.origin or {}
    destination = req.destination or {}
    origin_region = origin.get("city") or origin.get("country") or "local area"
    dest_region = destination.get("city") or destination.get("country") or "destination area"

    return {
        "fastest": f"Route via {origin_region} -> {dest_region}",
        "cheapest": "Consolidated route through major express corridor",
        "bestWarehouse": f"Warehouse near {origin_region}",
        "details": {
            "summary": f"Choose the nearest facility to {origin_region} to minimize transit time.",
            "reason": "Balanced delivery cost and speed for enterprise shipments.",
        },
    }


@app.post("/chat")
async def chat(req: ChatRequest):
    # Backwards compatible non-streaming endpoint.
    # For true streaming, use /stream-chat
    context_data = req.context or {}
    context = ChatContext(
        role=req.role or context_data.get("role") or "customer",
        companyId=req.companyId,
        trackingNumber=req.trackingNumber,
        shipment=context_data.get("shipment"),
        warehouse=context_data.get("warehouse"),
        analytics=context_data.get("analytics"),
        fraud=context_data.get("fraud"),
        recommendations=context_data.get("recommendations"),
    )

    messages = _messages_for_chat(req.message, context)
    try:
        reply = await generate_llm(messages)
    except Exception:
        reply = project_fallback_answer(req.message, context)
    return {"reply": reply}


class StreamChatRequest(BaseModel):
    message: str
    trackingNumber: str | None = None
    companyId: str | None = None
    context: Optional[dict] = None


@app.post("/stream-chat")
async def stream_chat(req: StreamChatRequest):
    context = None
    if req.context:
        # merge into ChatContext when possible
        try:
            context = ChatContext(**req.context)
        except Exception:
            context = None

    messages = _messages_for_chat(req.message, context)

    async def gen() -> AsyncGenerator[bytes, None]:
        try:
            async for token in stream_llm(messages):
                # SSE-like: send as plain text chunks; socket.io will forward
                yield token.encode("utf-8")
        except Exception:
            yield project_fallback_answer(req.message, context).encode("utf-8")

    return StreamingResponse(gen(), media_type="text/plain")


@app.post("/execute")
async def execute(req: ExecuteRequest):
    actionType = (req.actionType or "").strip()
    payload = req.payload or {}

    if actionType == "validate-location":
        return validate_location(ValidateLocationRequest(**payload))

    if actionType == "predict-eta":
        return predict_eta(PredictEtaRequest(**payload))

    if actionType == "detect-fraud":
        return detect_fraud(FraudRequest(**payload))

    if actionType == "tracking-insights":
        return tracking_insights(TrackingInsightsRequest(**payload))

    if actionType == "recommend":
        return recommend(RecommendRequest(**payload))

    if actionType == "chat":
        # Use req.payload.{message,trackingNumber,companyId}.
        # If backend sends context, forward it to /stream-chat in a later phase.
        chat_req = ChatRequest(**payload)
        return await chat(chat_req)

    return {"error": f"Unknown actionType: {actionType}"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)

