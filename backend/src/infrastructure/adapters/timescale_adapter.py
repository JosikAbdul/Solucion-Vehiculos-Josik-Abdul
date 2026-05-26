import psycopg2
from src.domain.entities import TelemetryEvent

class TimescaleDBAdapter:
    def __init__(self):
        
        self.conn = psycopg2.connect(
            host="localhost",
            database="fleet_db",
            user="josik_admin",
            password="MiPasswordSeguro2026",
            port="5432"
        )
        self.cursor = self.conn.cursor()
        self.setup_database()

    def setup_database(self):
        
        self.cursor.execute("""
            CREATE TABLE IF NOT EXISTS vehicle_telemetry (
                timestamp TIMESTAMPTZ NOT NULL,
                vehicle_id VARCHAR(50) NOT NULL,
                latitude DOUBLE PRECISION NOT NULL,
                longitude DOUBLE PRECISION NOT NULL,
                speed_kmh REAL NOT NULL
            );
        """)
        
        
        try:
            self.cursor.execute("SELECT create_hypertable('vehicle_telemetry', 'timestamp', if_not_exists => TRUE);")
        except Exception:
            
            pass
            
        self.conn.commit()

    def save_telemetry(self, event: TelemetryEvent):
        
        query = """
            INSERT INTO vehicle_telemetry (timestamp, vehicle_id, latitude, longitude, speed_kmh)
            VALUES (%s, %s, %s, %s, %s);
        """
        self.cursor.execute(query, (event.timestamp, event.vehicle_id, event.latitude, event.longitude, event.speed_kmh))
        self.conn.commit()