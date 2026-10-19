# Catálogo EEPSA — estado actual e integración con el SINV

> Documento de contexto para trabajar desde el repo del SINV (`Sistema-de-Inventario-RAM3`).
> Corte: **7 oct 2026**. Repo del catálogo: `EmilianoLedesma16/CatalogoEepsa` (local: `C:\Users\RAM\Documents\dev\CatalogoEepsa`).
> Producción: https://catalogo.eepsa.com.mx · No contiene secretos.

## 1. Resumen

- El catálogo **ya está programado para usar el SINV como fuente única** de productos, precios (IVA incluido), existencias y cotizaciones (folio `EEPSA-###`). El contrato que sigue es `docs/integrations/eepsa-api.md` del repo del SINV.
- **Hoy el SINV no está en producción**, así que el catálogo corre en **modo consulta**: muestra los ~60 productos de prueba precargados en su base local (`db/init.sql`), sin existencias, y **guarda las cotizaciones en una cola** que se entregará sola al SINV cuando esté conectado.
- El **autodeploy funciona** desde el 7 oct 2026: cada push/merge a `main` se despliega solo al Synology.
- Para conectar el SINV **no hace falta tocar código del catálogo**: basta con crear 3 secrets en GitHub y redesplegar (ver §7).
- **Falta definir el contenido real**: productos, SKUs, precios, fichas técnicas, fotos, líneas/categorías y promociones. Todo eso se captura **en el SINV**, no en el catálogo (ver §6).

## 2. Arquitectura

```
Navegador
   │  https://catalogo.eepsa.com.mx
   ▼
Cloudflare Tunnel (eepsa-cloudflared)
   ▼
eepsa-frontend  (React + Vite compilado, servido por nginx)
   │  /api/*  y  /catalogo-media/*  → proxy
   ▼
eepsa-backend   (Node 20 + Express + tsx, puerto 3001; BFF)
   │                                    │
   │ API key + firma HMAC               │ PostgreSQL
   ▼                                    ▼
SINV  /api/v1/integrations/eepsa/v1/*   eepsa-db (postgres:15)
                                         · productos  (respaldo + optic_times_id)
                                         · cola_sinv  (cotizaciones pendientes)
```

- Las llaves del SINV viven **sólo en el backend**; el navegador nunca habla con el SINV.
- Archivos clave: `backend/sinv.ts` (cliente firmado), `backend/index.ts` (endpoints, fallback y cola), `frontend/src/App.tsx`, `frontend/src/CartContext.tsx`, `docker-compose.yml`, `.github/workflows/deploy.yml`.

## 3. Infraestructura y despliegue

| Elemento | Valor |
|---|---|
| Servidor | Synology DS224+, Container Manager |
| Proyecto compose | `catalogo-eepsa` |
| Carpeta en el NAS | `/volume1/docker/CatalogoEepsa` (tiene el `.env` con el token del túnel y el PAT del runner) |
| Contenedores | `eepsa-db`, `eepsa-backend`, `eepsa-frontend`, `eepsa-cloudflared`, `eepsa-github-runner` |
| Autodeploy | GitHub Actions `deploy.yml` en runner self-hosted `synology-nas-runner` (imagen `myoung34/github-runner`) |

**Cómo despliega:** push a `main` → el runner hace checkout (dentro de su contenedor) → `docker-compose -p catalogo-eepsa up -d --build --no-deps frontend backend` → paso **Verify** contra `/api/health`. No toca `db`, `cloudflared` ni el runner. También se puede lanzar a mano: **Actions → Deploy to Synology NAS → Run workflow**.

**Mantenimiento del runner:**
- Usa un PAT classic (scope `repo`) en el `.env` del NAS como `GITHUB_ACCESS_TOKEN`. **Vence ~7 oct 2027.**
- Reusa su registro tras reinicios (`CONFIGURED_ACTIONS_RUNNER_FILES_DIR`, volumen `catalogo-eepsa_runner_config`).
- Si falla: ejecutar a mano la tarea de DSM **"Recrear runner catalogo"** (Programador de tareas) y revisar `/volume1/docker/CatalogoEepsa/recrear-runner.log`. Detalle en `docs/recuperar-runner-nas.md`.
- Tras un reinicio, `A session for this runner already exists` es normal unos minutos.

## 4. Contrato con el SINV (lo que el catálogo usa realmente)

Prefijo: `SINV_BASE_URL + /api/v1/integrations/eepsa/v1`. Timeout: 10 s (`SINV_TIMEOUT_MS`).

**Firma** (cada petición): `x-api-key`, `x-timestamp` (epoch en segundos), `x-signature: sha256=<HMAC-SHA256 hex>` sobre `${ts}.${MÉTODO}.${rutaCompletaConPrefijoYQuery}.${cuerpoJSON}`. Tolerancia ±300 s → **la hora del NAS y la del servidor del SINV deben estar sincronizadas por NTP**.

| Endpoint del SINV | Uso en el catálogo |
|---|---|
| `GET /health` | `/api/health` del catálogo (y el paso Verify del deploy) |
| `GET /catalog?page=N&pageSize=100` | Recorre todas las páginas. Lee `sku, name, description, line, category, unit, price, imageUrl, available, inStock, promotions[]`. Caché de 5 s |
| `POST /quotations` + `Idempotency-Key` | Crear cotización. Hasta 3 intentos rápidos con la misma llave; si no, a la cola |
| `GET /quotations/:code` | Seguimiento público `GET /api/cotizaciones/EEPSA-###` (sólo estado, sin datos del cliente) |

**Cuerpo que envía el catálogo** a `POST /quotations`:

```json
{
  "externalId": "CAT-<12 caracteres de la Idempotency-Key>",
  "customer": { "name": "…", "phone": "10 dígitos", "email": "opcional" },
  "items": [{ "sku": "ZG6516", "quantity": 2 }]
}
```

- Nombre (sólo letras) y teléfono (10 dígitos) **obligatorios**; correo opcional. Hoy **no** envía `company`, `phone2`, `jobTitle` ni `notes` (salvo `notes` en la reentrega de la cola, ver abajo).
- SKUs en mayúsculas; las cantidades repetidas del mismo SKU se suman.

**Cómo reacciona a cada respuesta:**

| Respuesta del SINV | Qué hace el catálogo |
|---|---|
| 200 / 201 | Muestra el folio `EEPSA-###` al cliente |
| Timeout, error de red, 5xx, 429 | Encola en `cola_sinv` → responde 202 "Recibimos tu solicitud…" |
| **401 / 403** (llaves o reloj mal) | Igual que arriba (encola) y deja en el log `⚠ SINV rechazó la firma` |
| 400 / 409 / 422 al cotizar en vivo | Muestra el mensaje de error del SINV al cliente |
| SINV sin configurar | Encola directamente |

**Cola `cola_sinv`:** cada 60 s reenvía hasta 20 pendientes con **su misma `Idempotency-Key`** (no se duplican). Si el SINV responde `422 UNKNOWN_SKU` (p. ej. el cliente cotizó un SKU del catálogo local que no existe en el SINV), reenvía **sólo los SKUs válidos** con una `notes` que lista los faltantes, usando la llave `<key>.r`. Estados: `PENDIENTE` → `ENVIADA` (con folio) o `RECHAZADA` (revisar a mano).

**Endpoints del SINV que el catálogo aún no usa:** `GET /catalog/:sku`, `POST /availability`, `updatedSince` (sincronización incremental) y el webhook de cambios de estado (`EEPSA_WEBHOOK_URL`).

## 5. Endpoints públicos del catálogo

| Endpoint | Descripción |
|---|---|
| `GET /api/productos[?tags=Línea,Categoría]` | Catálogo. Encabezado `x-catalog-source`: `sinv` · `sinv-stale` (última copia) · `local` |
| `GET /api/categorias` | Árbol línea → categorías (alimenta el menú y al asistente Nexi) |
| `POST /api/cotizaciones` | `{ idempotencyKey, cart:[{sku,cantidad}], contacto:{nombre, telefono, correo?} }`. Límite: 6 por IP cada 10 min |
| `GET /api/cotizaciones/:folio` | Estado público de una cotización |
| `GET /api/estado` | `{ cotizaciones: true }` (el frontend lo consulta al abrir el carrito) |
| `GET /api/health` | `{ status, sinv, configured, colaPendiente }`. 200 si está OK o sin configurar; 503 si está configurado y el SINV no responde |

## 6. Estado actual: modo consulta y datos de prueba

**Qué ve hoy el cliente** (verificado el 7 oct 2026: `x-catalog-source: local`, `/api/health` → `configured: false`, `colaPendiente: 0`):
- 60 productos de `db/init.sql` en 10 líneas: Redes e IT (12), Equipo Activo (8), Ensambles Ópticos (8), Herramientas FTTH (7), Cable de Fibra Óptica (6), CATV (5), Medición y Fusión (5), Tranceptores (5), Herrajes (3) y Kits de Fibra Óptica (1).
- **Precios estimados de prueba**, sin existencias (no se muestra "Disponible / No disponible"), fotos locales en `/catalogo-media/`.
- Aviso fijo: "Precios de referencia, sujetos a cambio sin previo aviso y a disponibilidad".
- Las cotizaciones se aceptan y quedan en `cola_sinv` hasta que exista el SINV.
- El carrito se guarda 24 h en el navegador (sólo productos y cantidades).

**Qué vive en cada sistema cuando el SINV esté conectado:**

| Dato | Dónde se define |
|---|---|
| SKU, nombre, descripción, unidad | **SINV** |
| Precio (IVA incluido) y promociones por paquete | **SINV** |
| Existencias (`available`, `inStock`) | **SINV** |
| Línea y categoría (menú, filtros y Nexi) | **SINV** (`line`, `category`) |
| Foto | **SINV** (`imageUrl`) |
| Enlace a la ficha técnica de Optic Times | **Catálogo**: columna `productos.optic_times_id`, se cruza **por SKU** |
| Cotizaciones y su seguimiento | **SINV** (bandeja de Telemarketing) |

⚠️ **Los SKUs del SINV deben coincidir con los de `productos` del catálogo** para que aparezca el botón de ficha técnica. Si un SKU sólo existe en el SINV, el producto se muestra sin ficha.

### Pendiente de definir (negocio)

- [ ] Lista definitiva de productos y **SKUs** (y si se conservan los SKUs de prueba de `init.sql`).
- [ ] **Precios** reales con IVA y promociones.
- [ ] **Fichas técnicas**: confirmar el `optic_times_id` de cada producto, o decidir mover la ficha al SINV (p. ej. un campo `specs` o una URL; el SINV ya expone `specs` en `/catalog`).
- [ ] **Fotos** definitivas (en el SINV, `imageUrl`).
- [ ] Nombres finales de **líneas y categorías**: el menú y Nexi salen tal cual del SINV.
- [ ] Qué hacer con los productos de prueba de `init.sql` una vez que el SINV sea la fuente.

## 7. Checklist para conectar el SINV en producción

1. SINV desplegado y accesible **desde el NAS** por HTTPS (`https://sinv.<dominio>`), con el módulo EEPSA activo y `EEPSA_API_KEY` / `EEPSA_HMAC_SECRET` de producción.
2. Productos reales cargados en el SINV (§6), con SKUs alineados a `optic_times_id`.
3. Hora sincronizada en el NAS (**Panel de control → Opciones regionales → Hora → NTP**, `time.google.com`) y en el servidor del SINV.
4. En GitHub del catálogo: **Settings → Secrets and variables → Actions**:
   - `SINV_BASE_URL` = `https://sinv.<dominio>` (sin `/` final)
   - `SINV_API_KEY` = `EEPSA_API_KEY`
   - `SINV_HMAC_SECRET` = `EEPSA_HMAC_SECRET`
5. **Actions → Deploy to Synology NAS → Run workflow** (los secrets se aplican al desplegar).
6. Ejecutar las pruebas de §8.

## 8. Pruebas post-despliegue

**Conexión**
- [ ] `GET https://catalogo.eepsa.com.mx/api/health` → `status: ok`, `sinv: true`, `configured: true`.
- [ ] El paso **Verify** del deploy queda en verde sin aviso amarillo.
- [ ] `GET /api/productos` → encabezado `x-catalog-source: sinv` y los productos reales.

**Catálogo**
- [ ] Líneas y categorías del menú = las del SINV; los conteos cuadran.
- [ ] Precio en el catálogo = precio en el SINV (IVA incluido).
- [ ] Mover existencias en el SINV → en ≤ 5 s cambia "Disponible / No disponible".
- [ ] Fotos visibles (las `imageUrl` del SINV deben ser accesibles desde internet).
- [ ] Botón de ficha técnica en los productos con `optic_times_id`.
- [ ] Promoción por paquete: el total coincide con el ejemplo de la doc del SINV.
- [ ] Si hay más de 100 productos: confirmar que el SINV acepta `pageSize=100` y que el catálogo trae todas las páginas.

**Cotizaciones**
- [ ] Cotizar con nombre + teléfono → folio `EEPSA-###` y la cotización aparece como **NUEVA** en Telemarketing.
- [ ] Repetir el envío (doble clic / recarga) → no se duplica.
- [ ] `GET /api/cotizaciones/EEPSA-###` → estado correcto; cambiarlo en el SINV y volver a consultar.
- [ ] SKU inexistente → mensaje de error claro.
- [ ] **Cola:** apagar el SINV o cambiar la URL → cotizar → respuesta "Recibimos tu solicitud" → `colaPendiente` sube → al volver el SINV, en ≤ 1 min llega con folio y `colaPendiente` = 0.
- [ ] **Reentrega con SKUs desconocidos:** cotización encolada con un SKU que no existe en el SINV → llega con los válidos y la nota de faltantes. Confirmar que el SINV no responde `409 IDEMPOTENCY_MISMATCH` por reusar el mismo `externalId` con otro cuerpo.
- [ ] **Firma:** llave mal copiada → el backend registra `⚠ SINV rechazó la firma` y la cotización queda en cola, no se pierde.
- [ ] Límite: la 7.ª cotización en 10 min desde la misma IP se rechaza.

**Resiliencia**
- [ ] SINV caído con el catálogo ya cargado → sigue mostrando la última copia (`x-catalog-source: sinv-stale`).
- [ ] Reiniciar el NAS → todos los contenedores vuelven y el runner queda **Idle**.

## 9. Pendientes técnicos conocidos (catálogo)

- **Cotizaciones de la etapa de prueba:** todo lo que entre en `cola_sinv` antes de conectar el SINV se entregará en cuanto haya llaves. Revisar la cola **antes** de poner los secrets por si hay pruebas internas que no deban llegar a Telemarketing (`SELECT * FROM cola_sinv WHERE estado='PENDIENTE'`).
- El webhook de cambios de estado del SINV no está implementado en el catálogo (opcional).
- `README.md` dice que basta teléfono **o** correo y menciona `empresa` / `notas`. El código actual exige **teléfono** y no envía empresa ni notas.
- `docs/recuperar-runner-nas.md` dice que el checkout actualiza la carpeta del NAS; en realidad el deploy construye desde la copia interna del runner. No afecta al funcionamiento.
- Tablas heredadas `cotizaciones` y `cotizacion_items` en `init.sql` ya no se usan.
- Credenciales de Postgres fijas en `docker-compose.yml` (la base no expone puertos fuera de Docker).
- Si un producto local no tiene precio, el frontend mostraría `$0.00` (hoy todos los de `init.sql` tienen precio).

## 10. Notas para sesiones de Claude

- Responder **en español**.
- **El usuario hace todos los commits y pushes.** Claude prepara los cambios y propone los mensajes; no debe aparecer como coautor.
- Ir **por fases** en todo lo que toque el NAS o producción, confirmando cada paso antes de seguir.
- No modificar el repo del catálogo desde sesiones del SINV sin acordarlo; si el contrato de la API del SINV cambia (campos de `/catalog`, `/quotations`, firma), avisar porque hay que ajustar `backend/sinv.ts` y `backend/index.ts`.
