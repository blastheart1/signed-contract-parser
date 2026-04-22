export type ProviderResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: IntegrationError };

export interface IntegrationError {
  provider: string;
  code: string;
  message: string;
  retryable: boolean;
  httpStatus?: number;
}
