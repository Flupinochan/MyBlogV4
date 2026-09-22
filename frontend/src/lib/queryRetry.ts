import { ApiError } from "./apiError";

const MAX_RETRY_COUNT = 5;

export function retryOn5xx(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRY_COUNT) return false;
  return error instanceof ApiError && error.status >= 500;
}
