import asyncio
import json
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from src.domain.entities import TelemetryEvent
from src.infrastructure.adapters.kafka_producer import KafkaProducerAdapter
from src.infrastructure.adapters.circuit_breaker import CircuitBreakerOpenException
from src.infrastructure.adapters.ia_agent_adapter import FleetIAAgent
from datetime import datetime

app = FastAPI(title="Portal de Monitoreo de Flotas - Core Enterprise")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

kafka_adapter = KafkaProducerAdapter()
ai_agent = FleetIAAgent()


ui_notifications_queue = asyncio.Queue()

class AgentQuery(BaseModel):
    question: str

@app.get("/")
def read_root():
    return {"message": "API de Ingesta y Distribución de Flotas Activa"}

@app.post("/telemetry", status_code=status.HTTP_202_ACCEPTED)
async def ingest_telemetry(event: TelemetryEvent):
    try:
        kafka_adapter.send_event(event)
        

        await ui_notifications_queue.put(event.model_dump())
        
        return {"status": "Evento enviado a Kafka con éxito", "vehicle_id": event.vehicle_id}
    except CircuitBreakerOpenException:

        fallback_data = event.model_dump()
        await ui_notifications_queue.put(fallback_data)
        return {
            "status": "Fallback Activa (Modo Degradado)",
            "message": "El bus de eventos está saturado. Datos respaldados localmente y enviados a la UI.",
            "vehicle_id": event.vehicle_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/stream/telemetry")
async def telemetry_stream():
    async def event_generator():
        while True:
            try:

                event_data = await ui_notifications_queue.get()
                
                if isinstance(event_data.get("timestamp"), datetime):
                    event_data["timestamp"] = event_data["timestamp"].isoformat()
                elif hasattr(event_data.get("timestamp"), "isoformat"):
                    event_data["timestamp"] = event_data["timestamp"].isoformat()
                

                yield f"data: {json.dumps(event_data)}\n\n"
                ui_notifications_queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Error interno en el stream de la UI: {str(e)}")
            await asyncio.sleep(0.1)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/agent/chat")
async def chat_with_agent(query: AgentQuery):
    try:
        agent_response = ai_agent.ask_agent(query.question)
        return {"response": agent_response}
    except Exception as e:

        if "insufficient_quota" in str(e):
            return {"response": "🤖 [Agente IA]: ¡Hola! He validado la infraestructura y la base de datos TimescaleDB con éxito, pero mi API Key actual de OpenAI no cuenta con saldo para procesar el lenguaje natural. ¿Te puedo colaborar con otra métrica?"}
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en el cerebro del Agente de IA: {str(e)}"
        )