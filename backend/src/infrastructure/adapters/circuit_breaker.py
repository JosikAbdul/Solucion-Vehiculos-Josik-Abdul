import time

class CircuitBreakerOpenException(Exception):
    pass

class CircuitBreaker:
    def __init__(self, failure_threshold=3, recovery_timeout=10):
        self.failure_threshold = failure_threshold  # Máximo de fallas permitidas
        self.recovery_timeout = recovery_timeout    # Tiempo en segundos para intentar recuperar (Cool down)
        self.failure_count = 0
        self.state = "CLOSED"  # Estados: CLOSED, OPEN, HALF-OPEN
        self.last_state_change = time.time()

    def __call__(self, func, *args, **kwargs):
        current_time = time.time()

       
        if self.state == "OPEN":
            if current_time - self.last_state_change > self.recovery_timeout:
                self.state = "HALF-OPEN"
                self.last_state_change = current_time
                print("🔌 [Circuit Breaker] Estado cambió a HALF-OPEN. Probando el servicio...")
            else:
                # Si sigue abierto y no ha pasado el tiempo, bloqueamos la ejecución de una vez
                raise CircuitBreakerOpenException("Circuito Abierto: El servicio no está disponible temporalmente.")

        try:
            
            result = func(*args, **kwargs)
            
            
            if self.state == "HALF-OPEN":
                self.state = "CLOSED"
                self.failure_count = 0
                self.last_state_change = current_time
                print("🟢 [Circuit Breaker] ¡Servicio recuperado! Estado cambió a CLOSED.")
            
            return result

        except Exception as e:
            
            self.failure_count += 1
            print(f"⚠️ [Circuit Breaker] Falla detectada ({self.failure_count}/{self.failure_threshold}): {str(e)}")
            
            
            if self.state in ["CLOSED", "HALF-OPEN"] and self.failure_count >= self.failure_threshold:
                self.state = "OPEN"
                self.last_state_change = current_time
                print(f"🔴 [Circuit Breaker] ¡CRÍTICO! Límite alcanzado. Estado cambió a OPEN por {self.recovery_timeout} segundos.")
            
            raise e