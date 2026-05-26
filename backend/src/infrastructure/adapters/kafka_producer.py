import json
from confluent_kafka import Producer
from src.domain.entities import TelemetryEvent
from src.infrastructure.adapters.circuit_breaker import CircuitBreaker

class KafkaProducerAdapter:
    def __init__(self):
        self.producer = Producer({
            'bootstrap.servers': 'localhost:19092',
            'client.id': 'fleet-telemetry-api',
            'socket.timeout.ms': 1000, # Tiempo límite de respuesta corto para fallar rápido
            'message.timeout.ms': 1000
        })
        self.topic = 'fleet-telemetry'
       
        self.breaker = CircuitBreaker(failure_threshold=3, recovery_timeout=10)

    def _execute_send(self, event: TelemetryEvent):
        payload = event.model_dump_json()
        self.producer.produce(
            topic=self.topic,
            key=event.vehicle_id,
            value=payload
        )
        self.producer.flush()

    def send_event(self, event: TelemetryEvent):
        # Envolvemos la ejecución dentro del Circuit Breaker
        return self.breaker(self._execute_send, event)