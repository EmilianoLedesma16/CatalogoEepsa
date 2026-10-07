# Recuperar el autodeploy del catálogo en el Synology

> Actualizado el 7 oct 2026. Repo: `EmilianoLedesma16/CatalogoEepsa`. No contiene secretos.

## Cómo funciona el autodeploy

- Cada push a `main` dispara `.github/workflows/deploy.yml`, que corre en un runner self-hosted
  (`eepsa-github-runner`, imagen `myoung34/github-runner`) **dentro del NAS**.
- El workspace del runner es la carpeta del proyecto en el NAS (normalmente `/volume1/docker/CatalogoEepsa`),
  así que el checkout actualiza esa carpeta y `docker-compose up -d --build --no-deps frontend backend`
  reconstruye sólo el catálogo. `db`, `cloudflared` y el propio runner no se tocan.
- Si el runner está apagado, el job queda **Queued** y GitHub lo **cancela a las 24 h**. Nada se despliega.

## Qué pasó

- **Desde el 16 sep 2026 el runner está caído** (bucle de reinicios con `Cannot configure the runner because
  it is already configured`). El contenedor se reinició con su configuración vieja, no pudo registrarse y,
  como usaba `RUNNER_TOKEN` (caduca en 1 h), ya no podía volver a registrarse solo.
- Los deploys #20–#23 (5 y 6 oct, commits `a8d2e29` … `e739100`) se **cancelaron sin runner asignado**.
  Lo que hay en producción es todavía `7ff3d15` (20 ago).
- `main` ya tiene el workflow corregido (`b95cb94`: `clean: false` para no borrar el `.env`, secrets `SINV_*`,
  `concurrency`, paso Verify) y el runner con `ACCESS_TOKEN`. Faltaba el **reuso del registro** tras reinicios
  (`CONFIGURED_ACTIONS_RUNNER_FILES_DIR`, `DISABLE_AUTOMATIC_DEREGISTRATION`, volumen `runner_config`):
  rama `ci/revivir-autodeploy`.

El repo no puede revivir el runner por sí solo (el runner es justo quien aplica los cambios). Hay que hacer
**una vez** los pasos de abajo en GitHub y en el NAS. Después, cada push a `main` se despliega solo, también
tras reinicios del NAS o actualizaciones de Container Manager.

---

## Paso 1 — Mergear `ci/revivir-autodeploy` → `main`

PR: https://github.com/EmilianoLedesma16/CatalogoEepsa/compare/main...ci/revivir-autodeploy

En **Files changed** sólo deben salir `docker-compose.yml` y este `docs/`. Al mergear se encola un deploy;
se quedará en *Queued* hasta el Paso 5 (es normal, tienes 24 h).

## Paso 2 — Borrar el runner viejo en GitHub

1. https://github.com/EmilianoLedesma16/CatalogoEepsa/settings/actions/runners
2. Si aparece **synology-nas-runner** (Offline): clic → **Remove** → **Force remove this runner**.
   Si no aparece, GitHub ya lo quitó (lo hace solo tras 14 días sin conectarse).

## Paso 3 — Token permanente (PAT)

1. GitHub → avatar → **Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic)**.
2. **Note:** `synology-runner-catalogo` · **Expiration:** 1 año (pon recordatorio) · **Scope:** sólo `repo`.
3. Copia el `ghp_…` (sólo se muestra una vez) a tu gestor de contraseñas.

Con el PAT el runner pide un token de registro nuevo en cada arranque; ya no hace falta el `RUNNER_TOKEN` de 1 h.

## Paso 4 — `.env` en el NAS

Carpeta del proyecto (`$DIR`): **Container Manager → Contenedor → eepsa-github-runner → Detalles → Volumen**,
el origen montado en `/opt/actions-runner/_work/CatalogoEepsa/CatalogoEepsa`.

1. **File Station** → `$DIR` (si no ves archivos con punto: **Configuración → General → Mostrar archivos ocultos**).
2. Descarga el `.env` si existe; si no, créalo en VS Code:
   ```
   CLOUDFLARE_TUNNEL_TOKEN=<el de Container Manager → eepsa-cloudflared → Entorno → TUNNEL_TOKEN>
   GITHUB_REPO_URL=https://github.com/EmilianoLedesma16/CatalogoEepsa
   GITHUB_ACCESS_TOKEN=<PAT del Paso 3>
   ```
   Fin de línea **LF** (abajo a la derecha en VS Code), sin espacios alrededor del `=`. Borra la línea
   `GITHUB_RUNNER_TOKEN=` si existe.
3. Súbelo a `$DIR` con **Cargar → Sobrescribir**. El nombre exacto es `.env` (sin `.txt`).

> ⚠️ Nunca levantes `cloudflared` desde tu PC con ese `.env`: se conectaría al túnel de producción.

## Paso 5 — Recrear el runner con el compose nuevo (Programador de tareas, sin SSH)

El `docker-compose.yml` que hay hoy en el NAS es el de agosto (sin `ACCESS_TOKEN` ni reuso). La tarea
descarga el de `main` (ya con el Paso 1 mergeado) y recrea **sólo** el runner.

**Panel de control → Programador de tareas → Crear → Tarea programada → Script definido por el usuario**:

- **General:** Tarea `Recrear runner catalogo` · Usuario `root` · desmarca **Habilitado** (se ejecuta a mano).
- **Configuración de tarea → Ejecutar comando:**
  ```bash
  export PATH=/usr/local/bin:/usr/bin:/bin:$PATH
  DIR=/volume1/docker/CatalogoEepsa
  LOG=$DIR/recrear-runner.log
  cd "$DIR" || exit 1
  echo "$(date)" > "$LOG"
  curl -fsSL https://raw.githubusercontent.com/EmilianoLedesma16/CatalogoEepsa/main/docker-compose.yml -o docker-compose.yml >> "$LOG" 2>&1
  grep -q CONFIGURED_ACTIONS_RUNNER_FILES_DIR docker-compose.yml || { echo "compose sin reuso: ¿se mergeó el Paso 1?" >> "$LOG"; exit 1; }
  PROJ=$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' eepsa-db)
  echo "proyecto=$PROJ" >> "$LOG"
  if [ -x /usr/local/bin/docker-compose ]; then DC=/usr/local/bin/docker-compose; else DC="docker compose"; fi
  docker rm -f eepsa-github-runner >> "$LOG" 2>&1
  docker volume rm "${PROJ}_runner_config" >> "$LOG" 2>&1
  HOST_PATH="$DIR" $DC -p "$PROJ" up -d --no-deps github-runner >> "$LOG" 2>&1
  sleep 30
  docker logs --tail 40 eepsa-github-runner >> "$LOG" 2>&1
  ```
- Guarda → selecciona la tarea → **Ejecutar**. Al minuto revisa `$DIR/recrear-runner.log`.

**Resultado esperado:** en el log `√ Connected to GitHub` y `Listening for Jobs`; en GitHub
**synology-nas-runner · Idle** (verde); en Container Manager el contenedor en verde fijo, sin parpadear.

Deja la tarea guardada: es el botón de “revivir runner” para cualquier problema futuro.

## Paso 6 — Verificar el deploy

1. Pestaña **Actions** → «Deploy to Synology NAS»: el deploy encolado del Paso 1 arranca solo.
   Si ya pasó de 24 h y se canceló: **Run workflow** (botón `workflow_dispatch`) sobre `main`.
2. **Checkout** ✅, **Deploy** ✅, **Verify** ✅. Sin los secrets `SINV_*` sale un aviso amarillo: es normal,
   el catálogo arranca en modo consulta.
3. **eepsa-backend → Registro**: `Backend listening on port 3001`.
4. https://catalogo.eepsa.com.mx en incógnito.
5. File Station: el `.env` **sigue existiendo**.
6. **Prueba de reinicio:** Container Manager → `eepsa-github-runner` → **Acción → Reiniciar**. Debe volver a
   verde fijo y seguir **Idle**, sin «already configured».

A partir de aquí: push/merge a `main` → deploy automático en ~2–5 min.

## Conectar con el SINV (cuando esté en producción)

**Settings → Secrets and variables → Actions → New repository secret**:

- `SINV_BASE_URL` = `https://sinv.<dominio>` (sin `/` final)
- `SINV_API_KEY` / `SINV_HMAC_SECRET` = `EEPSA_API_KEY` / `EEPSA_HMAC_SECRET` de producción del SINV

Hora del NAS sincronizada (**Panel de control → Opciones regionales → Hora → NTP**, `time.google.com`): la firma
tolera ±5 min. Luego **Actions → Run workflow** para redesplegar con los secrets.

## Si algo falla

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| Actions en *Queued* | Runner Offline | Paso 2 y luego ejecutar la tarea del Paso 5 |
| Log: `already configured` | Contenedor con configuración vieja | Ejecutar la tarea del Paso 5 (borra contenedor y `runner_config`) |
| Log: `404` / `NotFound` / `Bad credentials` | PAT caducado o sin scope `repo` | Nuevo PAT (Paso 3) → `.env` (Paso 4) → tarea del Paso 5 |
| Log: `A runner exists with the same name` | Quedó el registro viejo | Paso 2 → tarea del Paso 5 |
| Runner reinicia tras > 14 días apagado | GitHub borró el registro y el reusado ya no vale | Tarea del Paso 5 |
| `.env: no such file` / variables vacías | `.env` borrado o con CRLF | Paso 4 |
| Catálogo caído tras el deploy | Revisar `eepsa-backend` → Registro | En GitHub, **Revert** del PR mergeado (se despliega solo) |
