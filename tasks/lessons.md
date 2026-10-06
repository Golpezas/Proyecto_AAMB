# Lessons — Ping Platform

## Reglas de oro
1. **PII nunca en respuestas**: Cada endpoint debe verificarse contra fugas de teléfonos. Añadir test de grep en cada respuesta.
2. **bcrypt cost 12**: No bajar el costo por rendimiento — los PINs son cortos y vulnerables a brute force.
3. **Idempotencia obligatoria**: Todo envío SMS/Push lleva `ping_id:fan_id:method` como unique key.
4. **Nada de fixes temporales**: Si algo se complica, detenerse y replanificar.

## Errores registrados
_[Añadir aquí cada corrección del usuario]_
