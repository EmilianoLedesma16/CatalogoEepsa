// Monitor de solo lectura de la sincronización SINV ↔ catálogo (lo corre .github/workflows/monitor.yml).
// No crea cotizaciones ni cambia datos: sólo GET contra los dos sistemas, con la misma firma que backend/sinv.ts.
// Sale con código 1 si algo falla, y GitHub avisa por correo.
import crypto from 'node:crypto';
import { appendFileSync } from 'node:fs';

const SINV = (process.env.SINV_BASE_URL || 'https://sinv.eepsa.com.mx').replace(/\/$/, '');
const CATALOGO = (process.env.CATALOGO_URL || 'https://catalogo.eepsa.com.mx').replace(/\/$/, '');
const API_KEY = process.env.SINV_API_KEY ?? '';
const HMAC_SECRET = process.env.SINV_HMAC_SECRET ?? '';
const PREFIX = '/api/v1/integrations/eepsa/v1';

const results = [];
const check = async (name, fn) => {
  const t = Date.now();
  try {
    const detail = (await fn()) ?? '';
    results.push({ ok: true, name, detail, ms: Date.now() - t });
  } catch (err) {
    results.push({ ok: false, name, detail: err.message, ms: Date.now() - t });
  }
};
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, headers = {}) {
  const res = await fetch(url, { headers: { 'user-agent': 'eepsa-monitor', ...headers }, signal: AbortSignal.timeout(15_000) });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text, type: res.headers.get('content-type') ?? '' };
}

function signed(path) {
  const fullPath = PREFIX + path;
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = crypto.createHmac('sha256', HMAC_SECRET).update(`${ts}.GET.${fullPath}.`).digest('hex');
  return get(SINV + fullPath, { 'x-api-key': API_KEY, 'x-timestamp': ts, 'x-signature': `sha256=${sig}` });
}

async function sinvCatalog() {
  const items = [];
  for (let page = 1, total = 1; page <= total; page++) {
    const r = await signed(`/catalog?page=${page}&pageSize=100`);
    assert(r.status === 200, `catálogo firmado respondió ${r.status} ${r.text.slice(0, 120)}`);
    items.push(...r.json.data);
    total = r.json.meta.totalPages;
  }
  return items;
}

function diff(sinvItems, catalogo) {
  const bySku = new Map(catalogo.map((p) => [String(p.sku).toUpperCase(), p]));
  const out = [];
  for (const s of sinvItems) {
    const c = bySku.get(s.sku.toUpperCase());
    if (!c) out.push(`${s.sku}: está en el SINV y no en el catálogo`);
    else {
      if (Number(c.precio_estimado) !== Number(s.price)) out.push(`${s.sku}: precio SINV ${s.price} vs catálogo ${c.precio_estimado}`);
      if (c.disponible !== s.available) out.push(`${s.sku}: stock SINV ${s.available} vs catálogo ${c.disponible}`);
      if (c.en_stock !== s.inStock) out.push(`${s.sku}: en existencia SINV ${s.inStock} vs catálogo ${c.en_stock}`);
      bySku.delete(s.sku.toUpperCase());
    }
  }
  for (const sku of bySku.keys()) out.push(`${sku}: está en el catálogo y no en el SINV`);
  return out;
}

let sinvItems = [];

await check('SINV responde (/api/v1/health)', async () => {
  const r = await get(`${SINV}/api/v1/health`);
  assert(r.status === 200 && r.json?.status === 'ok', `HTTP ${r.status} ${r.text.slice(0, 120)}`);
});
await check('Cloudflare deja pasar la integración (sin firma = 401)', async () => {
  const r = await get(`${SINV}${PREFIX}/catalog`);
  assert(r.status === 401, `se esperaba 401 y llegó ${r.status}${r.type.includes('html') ? ' (página de Cloudflare: revisar regla WAF)' : ''}`);
});
await check('Firma aceptada (integración /v1/health)', async () => {
  assert(API_KEY && HMAC_SECRET, 'faltan los secrets SINV_API_KEY / SINV_HMAC_SECRET');
  const r = await signed('/health');
  assert(r.status === 200, `HTTP ${r.status} ${r.text.slice(0, 160)}`);
});
await check('Catálogo del SINV (firmado)', async () => {
  sinvItems = await sinvCatalog();
  assert(sinvItems.length > 0, 'el SINV devolvió 0 productos');
  return `${sinvItems.length} productos`;
});
await check('Catálogo conectado al SINV y sin cola (/api/health)', async () => {
  const r = await get(`${CATALOGO}/api/health`);
  assert(r.json, `HTTP ${r.status} ${r.text.slice(0, 120)}`);
  const { sinv, configured, colaPendiente } = r.json;
  assert(configured === true, 'el catálogo no tiene las llaves del SINV (modo consulta)');
  assert(sinv === true, 'el catálogo no logra hablar con el SINV');
  assert(colaPendiente === 0, `${colaPendiente} cotizaciones esperando en cola_sinv`);
});
await check('Productos, precios y stock iguales en los dos lados', async () => {
  assert(sinvItems.length, 'no se pudo leer el catálogo del SINV');
  let d = [];
  // El catálogo cachea 5 s: si alguien movió stock justo ahora, el segundo intento ya coincide
  for (let i = 0; i < 2; i++) {
    const r = await get(`${CATALOGO}/api/productos`);
    assert(r.status === 200 && Array.isArray(r.json), `catálogo /api/productos respondió ${r.status}`);
    d = diff(i ? await sinvCatalog() : sinvItems, r.json);
    if (!d.length) return `${r.json.length} productos coinciden`;
    await sleep(10_000);
  }
  throw new Error(`${d.length} diferencias: ${d.slice(0, 15).join(' · ')}`);
});
await check('Fotos de los productos cargan', async () => {
  const urls = sinvItems.map((p) => p.imageUrl).filter(Boolean);
  const bad = [];
  for (let i = 0; i < urls.length; i += 8) {
    await Promise.all(
      urls.slice(i, i + 8).map(async (u) => {
        try {
          const r = await fetch(u, { method: 'HEAD', signal: AbortSignal.timeout(15_000) });
          if (r.status !== 200 || !(r.headers.get('content-type') ?? '').startsWith('image/')) bad.push(`${u} (${r.status})`);
        } catch (e) {
          bad.push(`${u} (${e.message})`);
        }
      }),
    );
  }
  assert(!bad.length, `${bad.length} de ${urls.length} no cargan: ${bad.slice(0, 5).join(' · ')}`);
  return `${urls.length} fotos OK (${sinvItems.length - urls.length} productos sin foto)`;
});
await check('Páginas públicas cargan', async () => {
  for (const u of [`${SINV}/`, `${CATALOGO}/`]) {
    const r = await get(u);
    assert(r.status === 200, `${u} respondió ${r.status}`);
  }
});

const failed = results.filter((r) => !r.ok);
const lines = results.map((r) => `${r.ok ? '✅' : '❌'} ${r.name} (${r.ms} ms)${r.detail ? ` — ${r.detail}` : ''}`);
console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### Monitor SINV ↔ catálogo: ${failed.length ? `${failed.length} con falla` : 'todo bien'}\n\n${lines.map((l) => `- ${l}`).join('\n')}\n`,
  );
}
process.exit(failed.length ? 1 : 0);
