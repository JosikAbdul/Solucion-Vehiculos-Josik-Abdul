import os
import json
import psycopg2
from openai import OpenAI

class FleetIAAgent:
    def __init__(self):
         
        
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", "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"))
        
        
        self.db_params = {
            "host": "localhost",
            "database": "fleet_db",
            "user": "josik_admin",
            "password": "MiPasswordSeguro2026",
            "port": "5432"
        }

    def _execute_sql_query(self, sql_query: str):
        """Herramienta interna para que la IA consulte la base de datos"""
        try:
            conn = psycopg2.connect(**self.db_params)
            cursor = conn.cursor()
            cursor.execute(sql_query)
            columns = [desc[0] for desc in cursor.description]
            results = [dict(zip(columns, row)) for row in cursor.fetchall()]
            cursor.close()
            conn.close()
            return json.dumps(results, default=str)
        except Exception as e:
            return f"Error ejecutando la consulta en la base de datos: {str(e)}"

    def ask_agent(self, user_question: str) -> str:
        # 1. Definimos la herramienta (Tool) que el agente tiene permitido usar
        tools = [
            {
                "type": "function",
                "function": {
                    "name": "consultar_telemetria_vehiculos",
                    "description": "Ejecuta una consulta SQL SELECT en TimescaleDB para conocer el estado actual, velocidades y posiciones de los vehículos. Estructura de la tabla 'vehicle_telemetry': columns=(timestamp, vehicle_id, latitude, longitude, speed_kmh).",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "sql_query": {
                                "type": "string",
                                "description": "Consulta SQL limpia y optimizada para responder la pregunta del usuario. Ej: 'SELECT vehicle_id, speed_kmh FROM vehicle_telemetry WHERE speed_kmh = 0'"
                            }
                        },
                        "required": ["sql_query"]
                    }
                }
            }
        ]

        
        messages = [
            {
                "role": "system",
                "content": "Eres el Agente Operativo de Inteligencia Artificial del Portal de Monitoreo de Flotas. Tu trabajo es responder dudas de los operadores en lenguaje natural usando la base de datos de telemetría. Analiza la pregunta, genera el SQL correspondiente usando la herramienta provista, lee los datos resultantes y redacta una respuesta clara, profesional y concisa para el operador de la flota."
            },
            {"role": "user", "content": user_question}
        ]

        
        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tools=tools,
            tool_choice="auto"
        )
        
        response_message = response.choices[0].message
        tool_calls = response_message.tool_calls

        
        if tool_calls:
            messages.append(response_message)
            
            for tool_call in tool_calls:
                function_args = json.loads(tool_call.function.arguments)
                sql_to_run = function_args.get("sql_query")
                
                print(f"🤖 [Agente IA] Pensamiento: Necesito ejecutar SQL -> {sql_to_run}")
                
                
                tool_output = self._execute_sql_query(sql_to_run)
                
                
                messages.append({
                    "tool_call_id": tool_call.id,
                    "role": "tool",
                    "name": "consultar_telemetria_vehiculos",
                    "content": tool_output
                })
            
            
            second_response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages
            )
            return second_response.choices[0].message.content
            
        return response_message.content