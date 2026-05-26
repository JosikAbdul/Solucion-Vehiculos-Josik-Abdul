# Portal de Monitoreo de Flotas 

Sistema de telemetría de alta disponibilidad diseñado para la ingesta de coordenadas geográficas de cientos de vehículos en tiempo real, utilizando **FastAPI**, **Redpanda (Kafka-compatible)** y **TimescaleDB**.

---

##  1. Instrucciones de Ejecución Local (Docker Compose)

El ecosistema completo está orquestado para encenderse en segundos sin configuraciones manuales.

### Requisitos Previos
* Docker y Docker Desktop instalados.

### Encendido del Ecosistema
Ejecuta el siguiente comando en la raíz del proyecto para descargar, construir y levantar los contenedores en segundo plano:
```bash
docker compose up -d