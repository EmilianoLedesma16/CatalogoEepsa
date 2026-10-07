import crypto from 'node:crypto';

/**
 * Cliente servidor-a-servidor del SINV (fuente única de inventario y precios).
 * Firma cada petición con API key + HMAC-SHA256, según
 * Sistema-de-Inventario-RAM3/docs/integrations/eepsa-api.md.
 * La llave y el secreto viven sólo aquí (backend); nunca en el navegador.
 */

const BASE_URL = (process.env.SINV_BASE_URL ?? '').replace(/\/$/, '');
const API_KEY = process.env.SINV_API_KEY ?? '';
const HMAC_SECRET = process.env.SINV_HMAC_SECRET ?? '';
const TIMEOUT_MS = Number(process.env.SINV_TIMEOUT_MS ?? 10_000);

export const SINV_PREFIX = '/api/v1/integrations/eepsa/v1';

export const sinvConfigured = () => Boolean(BASE_URL && API_KEY && HMAC_SECRET);

export interface SinvResponse<T> {
  status: number;
  data: T;
}

/** Error de red, timeout o 5xx/429: se puede reintentar con la misma Idempotency-Key. */
export class SinvUnavailableError extends Error {}

export async function sinvRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<SinvResponse<T>> {
  if (!sinvConfigured()) {
    throw new SinvUnavailableError('SINV_BASE_URL / SINV_API_KEY / SINV_HMAC_SECRET no configurados');
  }
  const fullPath = SINV_PREFIX + path;
  const raw = body === undefined ? '' : JSON.stringify(body);
  const ts = Math.floor(Date.now() / 1000).toString();
  const signature = crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(`${ts}.${method}.${fullPath}.${raw}`)
    .digest('hex');

  let res: Response;
  try {
    res = await fetch(BASE_URL + fullPath, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,
        'x-timestamp': ts,
        'x-signature': `sha256=${signature}`,
        ...headers,
      },
      body: raw || undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new SinvUnavailableError(`SINV no responde: ${(err as Error).message}`);
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }
  if (res.status >= 500 || res.status === 429) {
    throw new SinvUnavailableError(`SINV respondió ${res.status}`);
  }
  // 401/403 = llaves mal copiadas o reloj del NAS desfasado (la firma tolera ±5 min). Es un
  // problema nuestro, no del cliente: la cotización se encola y sale sola al corregirlo.
  if (res.status === 401 || res.status === 403) {
    const code = (data as { code?: string } | null)?.code ?? '';
    console.error(`⚠ SINV rechazó la firma (${res.status} ${code}): revisar SINV_API_KEY, SINV_HMAC_SECRET y la hora del NAS`);
    throw new SinvUnavailableError(`SINV respondió ${res.status} ${code}`.trim());
  }
  return { status: res.status, data: data as T };
}

/** Mensaje legible de un error 4xx del SINV (Nest devuelve `message` como string o arreglo). */
export function sinvErrorMessage(data: unknown): string {
  const msg = (data as { message?: unknown } | null)?.message;
  if (Array.isArray(msg)) return msg.join('. ');
  if (typeof msg === 'string') return msg;
  return 'No se pudo procesar la cotización';
}
