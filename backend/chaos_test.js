import http from 'k6/http';
import { check, sleep } from 'k6';


export const options = {
  stages: [
    { duration: '30s', target: 200 }, // Sube rápido a 200 vehículos simulados
    { duration: '1m', target: 200 },  // Mantiene a los 200 vehículos inyectando datos por 1 minuto
    { duration: '15s', target: 0 },   // Baja a 0 para terminar de forma limpia
  ],
};


const BASE_URL = 'http://127.0.0.1:8000/telemetry';

export default function () {
  
  const vehicleId = `VEH-${__VU}`; 
  
  
  const telemetryData = {
    vehicle_id: vehicleId,
    timestamp: new Date().toISOString(),
    latitude: 4.6097 + (Math.random() - 0.5) * 0.05,
    longitude: -74.0817 + (Math.random() - 0.5) * 0.05,
    speed_kmh: Math.floor(Math.random() * 70) + 10,
  };

  const payload = JSON.stringify(telemetryData);
  const params = { headers: { 'Content-Type': 'application/json' } };

  
  const randomDice = Math.random() * 100; 

  if (randomDice <= 10) {
    
    
    const res1 = http.post(BASE_URL, payload, params);
    const res2 = http.post(BASE_URL, payload, params);
    
    check(res1, { 'Duplicado 1 exitoso (200 o 201)': (r) => r.status === 200 || r.status === 201 });
    check(res2, { 'Duplicado 2 procesado': (r) => r.status >= 200 });

  } else if (randomDice > 10 && randomDice <= 15) {
    
    
    const badRes = http.post(`${BASE_URL}/broken-endpoint-for-chaos`, payload, params);
    
    check(badRes, { 'Error 4xx/5xx provocado exitosamente': (r) => r.status >= 400 });

  } else {
    
    const normalRes = http.post(BASE_URL, payload, params);
    
    check(normalRes, { 'Peticion normal exitosa (200 o 201)': (r) => r.status === 200 || r.status === 201 });
  }

  
  sleep(1);
}