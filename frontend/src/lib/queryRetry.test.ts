import { describe, expect, test } from "vitest";
import { ApiError } from "./apiError";
import { retryOn5xx } from "./queryRetry";

describe("retryOn5xx", () => {
  test("5xxのApiErrorはリトライする", () => {
    expect(retryOn5xx(0, new ApiError(500, "server error"))).toBe(true);
    expect(retryOn5xx(0, new ApiError(503, "unavailable"))).toBe(true);
  });

  test("4xxのApiErrorはリトライしない", () => {
    expect(retryOn5xx(0, new ApiError(400, "bad request"))).toBe(false);
    expect(retryOn5xx(0, new ApiError(404, "not found"))).toBe(false);
  });

  test("ApiError以外のエラーはリトライしない", () => {
    expect(retryOn5xx(0, new Error("network"))).toBe(false);
    expect(retryOn5xx(0, undefined)).toBe(false);
  });

  test("失敗回数が上限に達したらリトライしない", () => {
    expect(retryOn5xx(4, new ApiError(500, "server error"))).toBe(true);
    expect(retryOn5xx(5, new ApiError(500, "server error"))).toBe(false);
  });
});
