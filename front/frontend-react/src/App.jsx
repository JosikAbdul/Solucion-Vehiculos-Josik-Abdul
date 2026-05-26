import React, { useState, useEffect, useRef } from 'react';
import { Shield, Radio, Navigation, AlertTriangle, Cpu, Send } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function App() {
  const [lastVehicle, setLastVehicle] = useState('Esperando...');
  const [lastSpeed, setLastSpeed] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [alerts, setAlerts] = useState([]);

  const [chatHistory, setChatHistory] = useState([
    { role: 'assistant', text: '¡Hola Josik! Soy tu asistente de flota. Puedo ejecutar consultas SQL analíticas sobre tu TimescaleDB automáticamente. ¿Qué deseas analizar hoy?' }
  ]);
  const [uiQuestion, setUiQuestion] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef({});

  useEffect(() => {
    if (!mapInstance.current && mapRef.current) {
      mapInstance.current = L.map(mapRef.current).setView([4.6097, -74.0817], 12);
      
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapInstance.current);
    }
  }, []);

  useEffect(() => {
    const eventSource = new EventSource('http://localhost:8000/stream/telemetry');

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      setLastVehicle(data.vehicle_id);
      setLastSpeed(data.speed_kmh);
      setTotalEvents((prev) => prev + 1);

      if (mapInstance.current) {
        const latLng = [data.latitude, data.longitude];
        
        if (markersRef.current[data.vehicle_id]) {
          markersRef.current[data.vehicle_id].setLatLng(latLng);
        } else {
          markersRef.current[data.vehicle_id] = L.marker(latLng).addTo(mapInstance.current);
        }
        
        markersRef.current[data.vehicle_id]
          .bindPopup(`<b>${data.vehicle_id}</b><br>Velocidad: ${data.speed_kmh} km/h`)
          .openPopup();
          
        mapInstance.current.panTo(latLng);
      }

      let colorClass = 'border-green-500 text-green-400 bg-green-500';
      let tag = '✅ INGESTA';
      if (data.speed_kmh > 100) {
        colorClass = 'border-red-500 text-red-400 bg-red-500';
        tag = '🚨 EXCESO VELOCIDAD';
      } else if (data.speed_kmh === 0) {
        colorClass = 'border-yellow-500 text-yellow-400 bg-yellow-500';
        tag = '⚠️ DETENIDO';
      }

      const newAlert = {
        time: new Date().toLocaleTimeString(),
        message: `${tag}: Vehículo ${data.vehicle_id} reportó posición en [Lat: ${data.latitude}, Lng: ${data.longitude}] moviéndose a ${data.speed_kmh} km/h`,
        color: colorClass
      };

      setAlerts((prev) => [newAlert, ...prev]);
    };

    eventSource.onerror = () => {
      console.error("Falla de conexión con el flujo SSE. Reintentando...");
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const handleAISubmit = async (e) => {
    e.preventDefault();
    if (!uiQuestion.trim() || loadingAI) return;

    const currentQuestion = uiQuestion;
    setChatHistory((prev) => [...prev, { role: 'user', text: currentQuestion }]);
    setUiQuestion('');
    setLoadingAI(true);

    try {
      const response = await fetch('http://localhost:8000/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: currentQuestion })
      });
      const result = await response.json();
      setChatHistory((prev) => [...prev, { role: 'assistant', text: result.response }]);
    } catch (error) {
      setChatHistory((prev) => [...prev, { role: 'assistant', text: 'Error de red al intentar conectar con el agente cognitivo.' }]);
    } finally {
      setLoadingAI(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex justify-between items-center shadow-md">
        <div className="flex items-center space-x-3">
          <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-ping"></div>
          <span className="text-lg font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
            FLEET-MONITOR // CONTROL ROOM
          </span>
        </div>
        <div className="flex items-center space-x-2 text-xs font-mono text-gray-400">
          <Radio size={14} className="text-green-400 animate-pulse" />
          <span>CANAL REACTIVO: <span className="text-green-400 font-bold">ONLINE (SSE)</span></span>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-3/4 p-4 flex flex-col space-y-4 h-full overflow-y-auto">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex items-center space-x-3 shadow">
              <Navigation className="text-blue-400" size={24} />
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Último Objetivo Activo</p>
                <h3 className="text-lg font-bold text-gray-100">{lastVehicle}</h3>
              </div>
            </div>
            <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex items-center space-x-3 shadow">
              <Shield className="text-yellow-400" size={24} />
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Velocidad de Ingesta</p>
                <h3 className="text-lg font-bold text-yellow-400">{lastSpeed} km/h</h3>
              </div>
            </div>
            <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex items-center space-x-3 shadow">
              <Cpu className="text-green-400" size={24} />
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Muestras Totales en Sesión</p>
                <h3 className="text-lg font-bold text-green-400">{totalEvents}</h3>
              </div>
            </div>
          </div>

          <div className="flex-1 bg-gray-900 rounded-xl border border-gray-800 overflow-hidden relative shadow">
            <div ref={mapRef} className="w-full h-full"></div>
          </div>

          <div className="h-1/4 bg-gray-900 p-4 rounded-xl border border-gray-800 flex flex-col shadow">
            <div className="flex items-center space-x-2 border-b border-gray-800 pb-2 mb-2">
              <AlertTriangle size={16} className="text-red-400" />
              <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">Flujo de Eventos Críticos de Telemetría</h4>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 font-mono text-[11px]">
              {alerts.map((alert, idx) => (
                <div key={idx} className={`p-2 rounded border border-opacity-30 bg-opacity-5 ${alert.color}`}>
                  <span className="font-bold">[{alert.time}]</span> - {alert.message}
                </div>
              ))}
              {alerts.length === 0 && (
                <p className="text-gray-600 text-center py-4">Esperando que FastAPI transmita eventos en tiempo real...</p>
              )}
            </div>
          </div>
        </div>

        <div className="w-1/4 bg-gray-900 border-l border-gray-800 p-4 flex flex-col h-full shadow-2xl">
          <div className="border-b border-gray-800 pb-3 mb-4">
            <h3 className="text-xs font-black text-purple-400 uppercase tracking-widest">🤖 AGENTE OPERATIVO IA</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Control inteligente analítico mediante lenguaje natural.</p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-[11px] mb-4">
            {chatHistory.map((msg, i) => (
              <div key={i} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
                <span className={`inline-block p-2.5 rounded-xl max-w-[90%] leading-relaxed whitespace-pre-wrap shadow-sm ${
                  msg.role === 'user' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-300 border border-gray-700'
                }`}>
                  {msg.text}
                </span>
              </div>
            ))}
            {loadingAI && (
              <div className="text-purple-400 animate-pulse text-left font-mono tracking-wider font-semibold">
                🤖 Analizando y orquestando consulta SQL...
              </div>
            )}
          </div>

          <form onSubmit={handleAISubmit} className="flex items-center space-x-2">
            <input
              type="text"
              value={uiQuestion}
              onChange={(e) => setUiQuestion(e.target.value)}
              placeholder="¿Qué vehículos están parados?..."
              disabled={loadingAI}
              className="flex-1 bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-xs text-gray-100 focus:outline-none focus:border-purple-500 transition"
            />
            <button
              type="submit"
              disabled={loadingAI}
              className="bg-purple-600 hover:bg-purple-700 text-white p-2.5 rounded-lg transition flex items-center justify-center shadow"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}