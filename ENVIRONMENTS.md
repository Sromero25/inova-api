# Definición de Entornos — inova-api

Este documento define las reglas de operación para cada uno de los tres entornos
del ciclo de vida del proyecto (DEV, QA y PROD), en alineación con el pipeline
configurado en `.github/workflows/ci.yml`.

---

## DEV (Desarrollo)

- **Rama asociada:** `develop`
- **¿Quién puede hacer push/deploy?** Cualquier integrante del equipo puede hacer
  push directamente a `develop`.
- **Pruebas obligatorias:** Pruebas unitarias básicas (`npm test`) sobre los
  endpoints de autenticación y de sesiones de chat.
- **Política de fallo:** Si una prueba falla, el pipeline **solo notifica**
  (no bloquea el push ya realizado). El error se reporta en la pestaña Actions
  para que el equipo lo corrija en un commit posterior.
- **Trigger en ci.yml:** `push.branches: [develop]`

---

## QA (Staging / Control de Calidad)

- **Rama asociada:** `staging`
- **¿Quién puede hacer merge?** Únicamente el Líder del equipo y el Scrum Master
  pueden aprobar y ejecutar el merge de `develop` hacia `staging`.
- **Pruebas obligatorias:** Pruebas de integración entre el backend (inova-api)
  y los endpoints consumidos por la app Android (inova-app): registro, login,
  creación de sesiones de chat y envío de mensajes con respuesta de Gemini.
- **Política de fallo:** Si alguna prueba de integración falla, **se bloquea
  el merge a staging** hasta que el error sea corregido.
- **Trigger en ci.yml:** `pull_request.branches: [main]` (etapa previa antes de
  habilitar el merge final a producción).

---

## PROD (Producción)

- **Rama asociada:** `main`
- **¿Quién puede hacer merge?** Únicamente el Líder del equipo, mediante un
  Pull Request explícito hacia `main`. No se permiten pushes directos a `main`.
- **Pruebas obligatorias:** Todas las pruebas configuradas en el pipeline
  (unitarias e integración) deben pasar en **ambas versiones de Node.js**
  definidas en la matrix (18 y 20).
- **Política de fallo:** Si cualquier prueba falla en cualquier versión de la
  matrix, **se bloquea completamente** el merge/deploy a `main`.
- **Trigger en ci.yml:** `push.branches: [main]`

---

## Resumen del flujo

```
developer → push → develop (DEV)
                       │
                       ▼  (merge autorizado por Líder/Scrum Master)
                    staging (QA) — pruebas de integración
                       │
                       ▼  (Pull Request autorizado solo por el Líder)
                      main (PROD) — todas las pruebas deben pasar
```
