function validateEnv(): void {
  const required = ['TRELLO_API_KEY', 'TRELLO_API_TOKEN'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.warn(
      `[atlas/trello] Missing env vars: ${missing.join(', ')} — running in mock mode`,
    );
  }
}

validateEnv();

const API_BASE = 'https://api.trello.com/1';

export async function trelloFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const key = process.env.TRELLO_API_KEY ?? '';
  const token = process.env.TRELLO_API_TOKEN ?? '';

  const separator = path.includes('?') ? '&' : '?';
  const url = `${API_BASE}${path}${separator}key=${key}&token=${token}`;

  const res = await fetch(url, options);

  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Trello API error ${res.status}: ${body}`);
    (err as unknown as Record<string, unknown>).httpStatus = res.status;
    throw err;
  }

  return res.json() as Promise<T>;
}
