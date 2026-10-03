import express, { Request, Response } from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { Pool } from 'pg';
import {
  SinvUnavailableError,
  sinvConfigured,
  sinvErrorMessage,
  sinvRequest,
} from './sinv';

/**
 * Backend del catálogo (BFF). El catálogo NO tiene inventario propio: productos,
 * precios (IVA incluido) y disponibilidad vienen del SINV en tiempo real, y las
 * cotizaciones se crean en el SINV (folio EEPSA-###), donde Telemarketing las
 * recibe al instante. La BD local sólo guarda:
 *   - `productos.optic_times_id` (enlace a la ficha técnica, contenido de marketing)
 *   - `cola_sinv`: cotizaciones que no se pudieron entregar porque el SINV no respondía;
 *     se reintentan solas con la misma Idempotency-Key (no se duplican).
 */

const app = express();
const port = process.env.PORT || 3001;

app.set('trust proxy', true);
app.use(cors());
app.use(express.json({ limit: '100kb' }));

// Imágenes locales heredadas (las fotos vigentes las sirve el SINV en `imageUrl`)
app.use('/catalogo-media', express.static('/app/public/img'));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const CATALOG_CACHE_MS = 5_000;
const QUEUE_INTERVAL_MS = 60_000;

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

interface SinvCatalogItem {
  sku: string;
  name: string;
  description: string | null;
  line: string | null;
  category: string | null;
  unit: string;
  price: string;
  imageUrl: string | null;
  available: number;
  inStock: boolean;
  promotions: Array<{
    code: string;
    title: string;
    packageQty: number;
    discountType: 'PORCENTAJE' | 'MONTO';
    discountValue: string;
  }>;
}

interface SinvPage<T> {
  data: T[];
  meta: { page: number; totalPages: number };
}

/** Forma que ya consume el frontend (se conserva para no reescribir las pantallas). */
interface CatalogProduct {
  id: string;
  sku: string;
  nombre: string;
  descripcion: string;
  precio_estimado: number;
  imagen_url: string | null;
  etiquetas: string[];
  linea: string | null;
  categoria: string | null;
  unidad: string;
  disponible: number;
  en_stock: boolean;
  promociones: SinvCatalogItem['promotions'];
  optic_times_id?: string;
}

let catalogCache: { at: number; products: CatalogProduct[] } | null = null;
let opticTimesCache: { at: number; bySku: Map<string, string> } | null = null;

async function opticTimesIds(): Promise<Map<string, string>> {
  if (opticTimesCache && Date.now() - opticTimesCache.at < 10 * 60_000) return opticTimesCache.bySku;
  try {
    const { rows } = await pool.query<{ sku: string; optic_times_id: string }>(
      'SELECT sku, optic_times_id FROM productos WHERE optic_times_id IS NOT NULL',
    );
    opticTimesCache = { at: Date.now(), bySku: new Map(rows.map((r) => [r.sku.toUpperCase(), r.optic_times_id])) };
  } catch (err) {
    console.error('No se pudo leer optic_times_id:', (err as Error).message);
    opticTimesCache = { at: Date.now(), bySku: new Map() };
  }
  return opticTimesCache.bySku;
}

async function loadCatalog(): Promise<CatalogProduct[]> {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_CACHE_MS) return catalogCache.products;

  const items: SinvCatalogItem[] = [];
  for (let page = 1, totalPages = 1; page <= totalPages; page++) {
    const res = await sinvRequest<SinvPage<SinvCatalogItem>>('GET', `/catalog?page=${page}&pageSize=100`);
    if (res.status !== 200) throw new SinvUnavailableError(`Catálogo SINV respondió ${res.status}`);
    items.push(...res.data.data);
    totalPages = res.data.meta.totalPages;
  }

  const optic = await opticTimesIds();
  const products = items.map<CatalogProduct>((p) => ({
    id: p.sku,
    sku: p.sku,
    nombre: p.name,
    descripcion: p.description ?? '',
    precio_estimado: Number(p.price),
    imagen_url: p.imageUrl,
    etiquetas: [p.line, p.category].filter((t): t is string => Boolean(t)),
    linea: p.line,
    categoria: p.category,
    unidad: p.unit,
    disponible: p.available,
    en_stock: p.inStock,
    promociones: p.promotions,
    optic_times_id: optic.get(p.sku.toUpperCase()),
  }));
  catalogCache = { at: Date.now(), products };
  return products;
}

/** Catálogo vigente; si el SINV no responde se sirve la última copia (máx. unos minutos de antigüedad). */
async function catalogOrStale(res: Response): Promise<CatalogProduct[] | null> {
  try {
    return await loadCatalog();
  } catch (err) {
    console.error('Error al consultar el catálogo del SINV:', (err as Error).message);
    if (catalogCache) {
      res.setHeader('x-catalog-stale', 'true');
      return catalogCache.products;
    }
    res.status(503).json({ error: 'El catálogo no está disponible en este momento. Intenta de nuevo en unos minutos.' });
    return null;
  }
}

const norm = (s: string) => s.toLowerCase().trim();

app.get('/api/productos', async (req: Request, res: Response) => {
  const products = await catalogOrStale(res);
  if (!products) return;
  const tags = typeof req.query.tags === 'string' ? req.query.tags.split(',').map(norm).filter(Boolean) : [];
  res.json(tags.length ? products.filter((p) => p.etiquetas.some((t) => tags.includes(norm(t)))) : products);
});

/** Líneas y categorías tal como están en el SINV (alimenta el menú lateral y a Nexi). */
app.get('/api/categorias', async (_req: Request, res: Response) => {
  const products = await catalogOrStale(res);
  if (!products) return;
  const tree = new Map<string, Set<string>>();
  for (const p of products) {
    if (!p.linea) continue;
    const subs = tree.get(p.linea) ?? new Set<string>();
    if (p.categoria) subs.add(p.categoria);
    tree.set(p.linea, subs);
  }
  const byName = (a: string, b: string) => a.localeCompare(b, 'es');
  res.json(
    [...tree.entries()]
      .sort(([a], [b]) => byName(a, b))
      .map(([name, subs]) => ({ name, sub: [...subs].sort(byName) })),
  );
});

// ---------------------------------------------------------------------------
// Cotizaciones
// ---------------------------------------------------------------------------

interface SinvQuotation {
  code: string;
  statusLabel: string;
  message: string;
  allAvailable: boolean;
  totals: { total: string };
}

interface SinvQuotationPayload {
  externalId: string;
  customer: { name: string; phone?: string; email?: string; company?: string };
  items: Array<{ sku: string; quantity: number }>;
  notes?: string;
}

const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,120}$/;
const PHONE = /^\+?\d{7,15}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Valida el cuerpo del frontend y arma el payload del SINV (determinista: mismo carrito ⇒ mismo cuerpo). */
function buildPayload(body: unknown, key: string): { payload?: SinvQuotationPayload; error?: string } {
  const b = (body ?? {}) as { cart?: unknown; contacto?: Record<string, unknown> };
  const cart = Array.isArray(b.cart) ? b.cart : [];
  if (cart.length === 0 || cart.length > 200) return { error: 'El carrito está vacío o es inválido' };

  const qty = new Map<string, number>();
  for (const raw of cart as Array<{ sku?: unknown; cantidad?: unknown }>) {
    const sku = clean(raw?.sku, 60).toUpperCase();
    const cantidad = Number(raw?.cantidad);
    if (!sku || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 1_000_000) {
      return { error: 'El carrito tiene productos o cantidades inválidas' };
    }
    qty.set(sku, (qty.get(sku) ?? 0) + cantidad);
  }

  const c = b.contacto ?? {};
  const name = clean(c.nombre, 160);
  const phone = clean(c.telefono, 30).replace(/[^\d+]/g, '');
  const email = clean(c.correo, 160).toLowerCase();
  const company = clean(c.empresa, 250);
  const notes = clean(c.notas, 2000);
  if (name.length < 2) return { error: 'Escribe tu nombre' };
  if (!phone && !email) return { error: 'Déjanos un teléfono o un correo para contactarte' };
  if (phone && !PHONE.test(phone)) return { error: 'El teléfono no es válido' };
  if (email && !EMAIL.test(email)) return { error: 'El correo no es válido' };

  return {
    payload: {
      externalId: `CAT-${key.replace(/[^A-Za-z0-9]/g, '').slice(0, 12).toUpperCase()}`,
      customer: {
        name,
        ...(phone && { phone }),
        ...(email && { email }),
        ...(company && { company }),
      },
      items: [...qty.entries()].map(([sku, quantity]) => ({ sku, quantity })),
      ...(notes && { notes }),
    },
  };
}

const sendToSinv = (payload: SinvQuotationPayload, key: string) =>
  sinvRequest<SinvQuotation>('POST', '/quotations', payload, { 'idempotency-key': key });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Hasta 3 intentos rápidos; después la cotización pasa a la cola local. */
async function sendWithRetry(payload: SinvQuotationPayload, key: string) {
  let last: unknown;
  for (const wait of [0, 700, 2_000]) {
    if (wait) await sleep(wait);
    try {
      return await sendToSinv(payload, key);
    } catch (err) {
      if (!(err instanceof SinvUnavailableError)) throw err;
      last = err;
    }
  }
  throw last;
}

// Límite simple por IP para evitar spam de leads (Cloudflare envía la IP real en CF-Connecting-IP).
const QUOTE_LIMIT = 6;
const QUOTE_WINDOW_MS = 10 * 60_000;
const recentQuotes = new Map<string, number[]>();
function rateLimited(req: Request): boolean {
  const ip = req.header('cf-connecting-ip') ?? req.ip ?? 'unknown';
  const now = Date.now();
  const hits = (recentQuotes.get(ip) ?? []).filter((t) => now - t < QUOTE_WINDOW_MS);
  if (hits.length >= QUOTE_LIMIT) return true;
  hits.push(now);
  recentQuotes.set(ip, hits);
  return false;
}

app.post('/api/cotizaciones', async (req: Request, res: Response) => {
  const key = clean(req.body?.idempotencyKey, 120) || crypto.randomUUID();
  if (!IDEMPOTENCY_KEY.test(key)) return res.status(400).json({ success: false, error: 'Solicitud inválida' });

  const { payload, error } = buildPayload(req.body, key);
  if (!payload) return res.status(400).json({ success: false, error });

  // Reintento de un envío que ya quedó en la cola: misma respuesta, sin duplicar
  const queued = await pool
    .query<{ referencia: string; folio: string | null }>(
      'SELECT referencia, folio FROM cola_sinv WHERE idempotency_key = $1',
      [key],
    )
    .catch(() => ({ rows: [] as Array<{ referencia: string; folio: string | null }> }));
  if (queued.rows[0]) {
    const q = queued.rows[0];
    return res.status(q.folio ? 200 : 202).json({
      success: true,
      pendiente: !q.folio,
      folio: q.folio,
      referencia: q.referencia,
      mensaje: q.folio
        ? 'Cotización recibida. Un asesor te contactará para confirmar existencias y cerrar la venta.'
        : 'Recibimos tu cotización. Un asesor te contactará en breve para confirmarla.',
    });
  }

  if (rateLimited(req)) {
    return res.status(429).json({ success: false, error: 'Has enviado varias cotizaciones seguidas. Espera unos minutos o llámanos.' });
  }

  try {
    const r = await sendWithRetry(payload, key);
    if (r.status === 200 || r.status === 201) {
      return res.status(201).json({
        success: true,
        folio: r.data.code,
        mensaje: r.data.message,
        total: r.data.totals?.total,
        disponible: r.data.allAvailable,
      });
    }
    // 4xx del SINV: SKU inexistente, validación, idempotencia
    console.warn('SINV rechazó la cotización', r.status, JSON.stringify(r.data));
    const unknown = (r.data as { details?: { skus?: string[] } } | null)?.details?.skus;
    return res.status(400).json({
      success: false,
      error: unknown?.length
        ? `Estos productos ya no están disponibles en el catálogo: ${unknown.join(', ')}. Quítalos e intenta de nuevo.`
        : sinvErrorMessage(r.data),
    });
  } catch (err) {
    if (!(err instanceof SinvUnavailableError)) {
      console.error('Error al crear la cotización:', err);
      return res.status(500).json({ success: false, error: 'No pudimos generar tu cotización. Intenta de nuevo.' });
    }
    // El SINV no responde: se guarda en la cola local y se reenvía solo
    const referencia = payload.externalId;
    try {
      await pool.query(
        `INSERT INTO cola_sinv (idempotency_key, referencia, payload, ultimo_error)
         VALUES ($1, $2, $3, $4) ON CONFLICT (idempotency_key) DO NOTHING`,
        [key, referencia, JSON.stringify(payload), err.message],
      );
    } catch (dbErr) {
      console.error('No se pudo encolar la cotización:', dbErr);
      return res.status(503).json({ success: false, error: 'No pudimos registrar tu cotización. Llámanos o intenta en unos minutos.' });
    }
    console.warn(`Cotización ${referencia} encolada: ${err.message}`);
    return res.status(202).json({
      success: true,
      pendiente: true,
      folio: null,
      referencia,
      mensaje: 'Recibimos tu cotización. Un asesor te contactará en breve para confirmarla.',
    });
  }
});

/** Seguimiento público: sólo el estado (sin datos del cliente ni montos). */
app.get('/api/cotizaciones/:folio', async (req: Request, res: Response) => {
  const folio = String(req.params.folio).toUpperCase();
  if (!/^EEPSA-\d{1,9}$/.test(folio)) return res.status(404).json({ error: 'Cotización no encontrada' });
  try {
    const r = await sinvRequest<SinvQuotation>('GET', `/quotations/${encodeURIComponent(folio)}`);
    if (r.status !== 200) return res.status(404).json({ error: 'Cotización no encontrada' });
    res.json({ folio: r.data.code, estado: r.data.statusLabel, mensaje: r.data.message });
  } catch {
    res.status(503).json({ error: 'No se pudo consultar el estado en este momento' });
  }
});

app.get('/api/health', async (_req: Request, res: Response) => {
  let sinv = false;
  try {
    sinv = (await sinvRequest('GET', '/health')).status === 200;
  } catch {
    sinv = false;
  }
  const pending = await pool
    .query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM cola_sinv WHERE estado = 'PENDIENTE'`)
    .then((r) => r.rows[0].n)
    .catch(() => null);
  res.status(sinv ? 200 : 503).json({ status: sinv ? 'ok' : 'degraded', sinv, configured: sinvConfigured(), colaPendiente: pending });
});

// ---------------------------------------------------------------------------
// Cola de reenvío
// ---------------------------------------------------------------------------

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cola_sinv (
      id SERIAL PRIMARY KEY,
      idempotency_key VARCHAR(120) UNIQUE NOT NULL,
      referencia VARCHAR(40) NOT NULL,
      payload JSONB NOT NULL,
      estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
      intentos INTEGER NOT NULL DEFAULT 0,
      ultimo_error TEXT,
      folio VARCHAR(40),
      creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      enviado_en TIMESTAMP
    )`);
}

let draining = false;
async function drainQueue() {
  if (draining || !sinvConfigured()) return;
  draining = true;
  try {
    const { rows } = await pool.query<{ id: number; idempotency_key: string; referencia: string; payload: SinvQuotationPayload }>(
      `SELECT id, idempotency_key, referencia, payload FROM cola_sinv
       WHERE estado = 'PENDIENTE' ORDER BY id LIMIT 20`,
    );
    for (const row of rows) {
      try {
        const r = await sendToSinv(row.payload, row.idempotency_key);
        if (r.status === 200 || r.status === 201) {
          await pool.query(
            `UPDATE cola_sinv SET estado = 'ENVIADA', folio = $2, enviado_en = now(), intentos = intentos + 1 WHERE id = $1`,
            [row.id, r.data.code],
          );
          console.log(`Cola: ${row.referencia} entregada como ${r.data.code}`);
        } else {
          await pool.query(
            `UPDATE cola_sinv SET estado = 'RECHAZADA', ultimo_error = $2, intentos = intentos + 1 WHERE id = $1`,
            [row.id, `${r.status}: ${JSON.stringify(r.data)}`],
          );
          console.error(`Cola: ${row.referencia} rechazada por el SINV (${r.status}); revisar manualmente`);
        }
      } catch (err) {
        await pool.query(`UPDATE cola_sinv SET intentos = intentos + 1, ultimo_error = $2 WHERE id = $1`, [
          row.id,
          (err as Error).message,
        ]);
        break; // el SINV sigue caído: se reintenta en la siguiente vuelta
      }
    }
  } catch (err) {
    console.error('Error al procesar la cola:', (err as Error).message);
  } finally {
    draining = false;
  }
}

ensureSchema()
  .catch((err) => console.error('No se pudo preparar la tabla cola_sinv:', err.message))
  .finally(() => {
    if (!sinvConfigured()) console.warn('⚠ SINV no configurado: define SINV_BASE_URL, SINV_API_KEY y SINV_HMAC_SECRET');
    setInterval(() => void drainQueue(), QUEUE_INTERVAL_MS).unref();
    app.listen(port, () => console.log(`Backend listening on port ${port}`));
  });
