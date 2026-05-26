import * as Network from 'expo-network';
import * as SQLite from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import { Alert, Button, StyleSheet, Text, View } from 'react-native';

// URL de tu backend (Tu FastAPI)
const BACKEND_URL = 'http://127.0.0.1:8000/telemetry'; 

// Definimos qué datos tiene un evento de telemetría para que TypeScript no se queje
interface TelemetryRow {
  id: number;
  vehicle_id: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  speed_kmh: number;
}

export default function App() {
  const VEHICLE_ID = "ZZN-848"; // Tu vehículo de pruebas
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  
  // Le especificamos a TypeScript que aquí se guardará la Base de Datos de SQLite
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);

  // 1. Inicializar la Base de Datos Local SQLite al arrancar
  useEffect(() => {
    async function setupDatabase() {
      try {
        const database = await SQLite.openDatabaseAsync('fleet_offline.db');
        await database.execAsync(`
          PRAGMA journal_mode = WAL;
          CREATE TABLE IF NOT EXISTS telemetry_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicle_id TEXT,
            timestamp TEXT,
            latitude REAL,
            longitude REAL,
            speed_kmh REAL
          );
        `);
        setDb(database);
        console.log("💾 Base de datos SQLite lista en el celular.");
      } catch (error) {
        console.error("Error al abrir SQLite:", error);
      }
    }
    setupDatabase();
  }, []);

  // 2. Monitorear el estado del Internet en el celular
  useEffect(() => {
    const checkNetwork = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        const online = state.isConnected && state.isInternetReachable;
        setIsOnline(!!online);
      } catch (e) {
        setIsOnline(false);
      }
    };

    const interval = setInterval(checkNetwork, 4000); // Revisa cada 4 segundos
    return () => clearInterval(interval);
  }, []);

  // 3. Sincronizar los datos guardados en bloque al recuperar internet
  useEffect(() => {
    if (isOnline && db) {
      triggerBatchSync();
    }
  }, [isOnline, db]);

  // 4. Función para procesar y enviar la ubicación (Tipamos los parámetros de entrada)
  const processTelemetry = async (latitude: number, longitude: number, speedKmh: number) => {
    const telemetryEvent = {
      vehicle_id: VEHICLE_ID,
      timestamp: new Date().toISOString(),
      latitude,
      longitude,
      speed_kmh: speedKmh
    };

    if (isOnline) {
      try {
        const response = await fetch(BACKEND_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(telemetryEvent),
        });

        if (response.ok) {
          console.log("🚀 Enviado en vivo a FastAPI");
          return;
        }
      } catch (error) {
        console.log("⚠️ Falla de red temporal, guardando en SQLite...");
      }
    }

    // Si no hay red, guardamos en la memoria interna (SQLite)
    if (db) {
      await db.runAsync(
        `INSERT INTO telemetry_queue (vehicle_id, timestamp, latitude, longitude, speed_kmh) VALUES (?, ?, ?, ?, ?);`,
        [telemetryEvent.vehicle_id, telemetryEvent.timestamp, telemetryEvent.latitude, telemetryEvent.longitude, telemetryEvent.speed_kmh]
      );
      Alert.alert("Offline", "Coordenada guardada localmente en el celular.");
    }
  };

  // 5. Vaciar la base de datos local hacia el servidor
  const triggerBatchSync = async () => {
    if (!db || syncing) return;
    
    // Le decimos que el resultado de la consulta son filas tipo TelemetryRow
    const rows = await db.getAllAsync<TelemetryRow>('SELECT * FROM telemetry_queue ORDER BY id ASC;');
    if (rows.length === 0) return;

    setSyncing(true);
    console.log(`🔄 Sincronizando en bloque ${rows.length} puntos acumulados...`);

    let lastId = -1;
    try {
      for (const row of rows) {
        const response = await fetch(BACKEND_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vehicle_id: row.vehicle_id,
            timestamp: row.timestamp,
            latitude: row.latitude,
            longitude: row.longitude,
            speed_kmh: row.speed_kmh
          }),
        });
        if (response.ok) lastId = row.id;
      }
      if (lastId !== -1) {
        await db.runAsync('DELETE FROM telemetry_queue WHERE id <= ?;', [lastId]);
        console.log("🧹 Memoria local limpia.");
      }
    } catch (err) {
      console.log("Error sincronizando lote:", err);
    } finally {
      setSyncing(false);
    }
  };

  // Simular movimiento en Bogotá
  const handleSimulateGPS = () => {
    const mockLat = 4.6097 + (Math.random() - 0.5) * 0.02;
    const mockLng = -74.0817 + (Math.random() - 0.5) * 0.02;
    const mockSpeed = Math.floor(Math.random() * 80) + 10;
    processTelemetry(mockLat, mockLng, mockSpeed);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🚚 App del Conductor</Text>
      <View style={[styles.badge, { backgroundColor: isOnline ? '#2e7d32' : '#c62828' }]}>
        <Text style={styles.badgeText}>{isOnline ? "🟢 INTERNET ONLINE" : "🔴 MODO OFFLINE (SQLite)"}</Text>
      </View>
      {syncing && <Text style={styles.syncText}>⏳ Sincronizando bloque de datos...</Text>}
      <Button title="Simular Cambio GPS" onPress={handleSimulateGPS} color="#007bff" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121824', alignItems: 'center', justifyContent: 'center', padding: 20 },
 title: { 
  fontSize: 24, 
  color: '#fff', 
  textAlign: 'center', // <-- Cambiado 'Typography' por 'textAlign' que es el correcto
  marginBottom: 20, 
  fontWeight: 'bold' 
},
  badge: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginBottom: 30 },
  badgeText: { color: '#fff', fontWeight: 'bold' },
  syncText: { color: '#ffb300', marginBottom: 15, fontWeight: 'bold' }
});