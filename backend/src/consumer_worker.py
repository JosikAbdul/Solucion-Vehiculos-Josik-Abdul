import json
from confluent_kafka import Consumer, KafkaError
from src.domain.entities import TelemetryEvent
from src.infrastructure.adapters.timescale_adapter import TimescaleDBAdapter

def run_consumer():
    
    consumer = Consumer({
        'bootstrap.servers': 'localhost:19092',
        'group.id': 'timescaledb-persister-group',
        'auto.offset.reset': 'earliest'
    })
    consumer.subscribe(['fleet-telemetry'])

    
    db = TimescaleDBAdapter()
    print("🚀 Consumidor de TimescaleDB escuchando eventos en tiempo real...")

    try:
        while True:
            msg = consumer.poll(1.0) # Espera mensajes
            if msg is None:
                continue
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                else:
                    print(f"Error en Kafka: {msg.error()}")
                    break

            
            data = json.loads(msg.value().decode('utf-8'))
            
            
            event = TelemetryEvent(**data)
            
            
            db.save_telemetry(event)
            print(f"💾 Guardado en TimescaleDB: Vehículo {event.vehicle_id} a {event.speed_kmh} km/h")

    except KeyboardInterrupt:
        pass
    finally:
        consumer.close()

if __name__ == "__main__":
    run_consumer()