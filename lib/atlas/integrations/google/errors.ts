import type { IntegrationError } from '../types';

export function mapGoogleError(err: unknown): IntegrationError {
  // googleapis throws GaxiosError objects; cast to extract status fields
  const e = err as Record<string, unknown>;
  const status = (
    e?.code ?? (e?.response as Record<string, unknown>)?.status ?? 0
  ) as number;
  const message =
    typeof e?.message === 'string' ? e.message : 'Unknown Google Workspace error';

  let code: string;
  if (status === 404) code = 'NOT_FOUND';
  else if (status === 409) code = 'ALREADY_EXISTS';
  else if (status === 429) code = 'RATE_LIMITED';
  else if (status >= 500) code = 'SERVER_ERROR';
  else code = 'UNKNOWN';

  return {
    provider: 'google',
    code,
    message,
    retryable: status === 429 || status >= 500,
    httpStatus: status || undefined,
  };
}
