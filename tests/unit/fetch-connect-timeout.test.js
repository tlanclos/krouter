import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The Endpoint page's upstream connect-timeout knob is stored as
 * settings.fetchConnectTimeoutMs and mirrored into the in-process store that
 * the open-sse executors read at request time, so a save takes effect without a
 * restart. Bounds (10s–600s) are enforced at the PATCH boundary and again in
 * the store.
 */
const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn(async (body) => ({ ...body })),
}));
vi.mock("@/lib/localDb", () => mocks);
vi.mock("@/lib/network/outboundProxy", () => ({ applyOutboundProxyEnv: vi.fn() }));
vi.mock("open-sse/services/combo.js", () => ({ resetComboRotation: vi.fn() }));

const { PATCH } = await import("../../src/app/api/settings/route.js");
const { applyFetchTimeoutSetting } = await import("../../src/lib/fetchTimeoutSetting.js");
const {
  getFetchConnectTimeoutMs,
  setFetchConnectTimeoutMs,
  clampFetchConnectTimeoutMs,
  FETCH_CONNECT_TIMEOUT_DEFAULT_MS,
  FETCH_CONNECT_TIMEOUT_MIN_MS,
  FETCH_CONNECT_TIMEOUT_MAX_MS,
} = await import("../../open-sse/config/runtimeConfig.js");

const patch = (body) =>
  PATCH(new Request("http://localhost/api/settings", { method: "PATCH", body: JSON.stringify(body) }));

beforeEach(() => {
  mocks.updateSettings.mockClear();
  setFetchConnectTimeoutMs(FETCH_CONNECT_TIMEOUT_DEFAULT_MS);
});

describe("getFetchConnectTimeoutMs", () => {
  it("returns the default until a value is applied", () => {
    expect(getFetchConnectTimeoutMs()).toBe(FETCH_CONNECT_TIMEOUT_DEFAULT_MS);
  });

  it("returns the applied value", () => {
    setFetchConnectTimeoutMs(180000);

    expect(getFetchConnectTimeoutMs()).toBe(180000);
  });
});

describe("setFetchConnectTimeoutMs", () => {
  it("stores a value inside the bounds", () => {
    setFetchConnectTimeoutMs(180000);

    expect(getFetchConnectTimeoutMs()).toBe(180000);
  });

  it("clamps a value below the floor up to it", () => {
    setFetchConnectTimeoutMs(5000);

    expect(getFetchConnectTimeoutMs()).toBe(FETCH_CONNECT_TIMEOUT_MIN_MS);
  });

  it("clamps a value above the ceiling down to it", () => {
    setFetchConnectTimeoutMs(9999999);

    expect(getFetchConnectTimeoutMs()).toBe(FETCH_CONNECT_TIMEOUT_MAX_MS);
  });

  it("ignores a missing value", () => {
    setFetchConnectTimeoutMs(180000);

    setFetchConnectTimeoutMs(undefined);

    expect(getFetchConnectTimeoutMs()).toBe(180000);
  });

  it("ignores a non-number value", () => {
    setFetchConnectTimeoutMs(180000);

    setFetchConnectTimeoutMs("60000");

    expect(getFetchConnectTimeoutMs()).toBe(180000);
  });
});

describe("clampFetchConnectTimeoutMs", () => {
  it("leaves a value inside the bounds untouched", () => {
    expect(clampFetchConnectTimeoutMs(180000)).toBe(180000);
  });

  it("clamps a value below the floor up to it", () => {
    expect(clampFetchConnectTimeoutMs(5000)).toBe(FETCH_CONNECT_TIMEOUT_MIN_MS);
  });

  it("clamps a value above the ceiling down to it", () => {
    expect(clampFetchConnectTimeoutMs(9999999)).toBe(FETCH_CONNECT_TIMEOUT_MAX_MS);
  });
});

describe("PATCH /api/settings fetchConnectTimeoutMs", () => {
  it("stores a valid value", async () => {
    const body = { fetchConnectTimeoutMs: 180000 };

    await patch(body);

    expect(mocks.updateSettings.mock.calls[0][0].fetchConnectTimeoutMs).toBe(180000);
  });

  it("applies a valid value to the running process", async () => {
    const body = { fetchConnectTimeoutMs: 180000 };

    await patch(body);

    expect(getFetchConnectTimeoutMs()).toBe(180000);
  });

  it("responds 200 to a valid value", async () => {
    const body = { fetchConnectTimeoutMs: 180000 };

    const res = await patch(body);

    expect(res.status).toBe(200);
  });

  it("rejects a value below the floor", async () => {
    const body = { fetchConnectTimeoutMs: 5000 };

    const res = await patch(body);

    expect(res.status).toBe(400);
  });

  it("stores nothing for a value below the floor", async () => {
    const body = { fetchConnectTimeoutMs: 5000 };

    await patch(body);

    expect(mocks.updateSettings).not.toHaveBeenCalled();
  });

  it("leaves the running value alone for a value below the floor", async () => {
    const body = { fetchConnectTimeoutMs: 5000 };

    await patch(body);

    expect(getFetchConnectTimeoutMs()).toBe(FETCH_CONNECT_TIMEOUT_DEFAULT_MS);
  });

  it("rejects a value above the ceiling", async () => {
    const body = { fetchConnectTimeoutMs: 900000 };

    const res = await patch(body);

    expect(res.status).toBe(400);
  });

  it("stores nothing for a value above the ceiling", async () => {
    const body = { fetchConnectTimeoutMs: 900000 };

    await patch(body);

    expect(mocks.updateSettings).not.toHaveBeenCalled();
  });

  it("rejects non-numeric input", async () => {
    const body = { fetchConnectTimeoutMs: "soon" };

    const res = await patch(body);

    expect(res.status).toBe(400);
  });

  it("stores nothing for non-numeric input", async () => {
    const body = { fetchConnectTimeoutMs: "soon" };

    await patch(body);

    expect(mocks.updateSettings).not.toHaveBeenCalled();
  });

  it("responds 200 when the request does not mention the setting", async () => {
    const body = { requireLogin: true };

    const res = await patch(body);

    expect(res.status).toBe(200);
  });

  it("leaves the setting alone when the request does not mention the setting", async () => {
    const body = { requireLogin: true };

    await patch(body);

    expect(mocks.updateSettings.mock.calls[0][0]).not.toHaveProperty("fetchConnectTimeoutMs");
  });

  it("leaves the running value alone when the request does not mention the setting", async () => {
    const body = { requireLogin: true };

    await patch(body);

    expect(getFetchConnectTimeoutMs()).toBe(FETCH_CONNECT_TIMEOUT_DEFAULT_MS);
  });
});

describe("applyFetchTimeoutSetting", () => {
  it("applies a saved value", () => {
    applyFetchTimeoutSetting({ fetchConnectTimeoutMs: 180000 });

    expect(getFetchConnectTimeoutMs()).toBe(180000);
  });

  it("clamps a saved value above the ceiling", () => {
    applyFetchTimeoutSetting({ fetchConnectTimeoutMs: 9999999 });

    expect(getFetchConnectTimeoutMs()).toBe(FETCH_CONNECT_TIMEOUT_MAX_MS);
  });

  it("is a no-op when the setting is missing", () => {
    setFetchConnectTimeoutMs(120000);

    applyFetchTimeoutSetting({});

    expect(getFetchConnectTimeoutMs()).toBe(120000);
  });

  it("is a no-op when the setting is not a number", () => {
    setFetchConnectTimeoutMs(120000);

    applyFetchTimeoutSetting({ fetchConnectTimeoutMs: "60000" });

    expect(getFetchConnectTimeoutMs()).toBe(120000);
  });

  it("is a no-op when the setting is null", () => {
    setFetchConnectTimeoutMs(120000);

    applyFetchTimeoutSetting({ fetchConnectTimeoutMs: null });

    expect(getFetchConnectTimeoutMs()).toBe(120000);
  });
});
