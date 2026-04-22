import type { IntegrationError } from '../types';

export function mapTrelloError(err: unknown): IntegrationError {
  const e = err as Record<string, unknown>;
  const status = (e?.httpStatus ?? 0) as number;
  const message =
    typeof e?.message === 'string' ? e.message : 'Unknown Trello error';

  let code: string;
  if (status === 404) code = 'NOT_FOUND';
  else if (status === 409) code = 'ALREADY_EXISTS';
  else if (status === 429) code = 'RATE_LIMITED';
  else if (status >= 500) code = 'SERVER_ERROR';
  else code = 'UNKNOWN';

  return {
    provider: 'trello',
    code,
    message,
    retryable: status === 429 || status >= 500,
    httpStatus: status || undefined,
  };
}
