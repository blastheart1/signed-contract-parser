function validateEnv(): void {
  if (!process.env.TRAINUAL_API_KEY) {
    console.warn('[atlas/trainual] Missing TRAINUAL_API_KEY — running in mock mode');
  }
}

validateEnv();

const API_BASE = 'https://app.trainual.com/api/v1';

export async function trainualFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const apiKey = process.env.TRAINUAL_API_KEY ?? '';
  // Trainual uses HTTP Basic auth: base64(API_KEY:x)
  const credentials = Buffer.from(`${apiKey}:x`).toString('base64');

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${credentials}`,
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Trainual API error ${res.status}: ${body}`);
    (err as unknown as Record<string, unknown>).httpStatus = res.status;
    throw err;
  }

  return res.json() as Promise<T>;
}
