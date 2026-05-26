from pydantic import BaseModel, Field
from datetime import datetime

class TelemetryEvent(BaseModel):
    vehicle_id: str = Field(..., example="VEH-2026-XYZ")
    timestamp: datetime = Field(..., default_factory=datetime.utcnow)
    latitude: float = Field(..., ge=-90, le=90, example=4.6097)
    longitude: float = Field(..., ge=-180, le=180, example=-74.0817)
    speed_kmh: float = Field(..., ge=0, example=65.5)