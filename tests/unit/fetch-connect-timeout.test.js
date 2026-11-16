import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The Endpoint page's upstream connect-timeout knob is stored as
 * settings.fetchConnectTimeoutMs and mirrored into env
 * FETCH_CONNECT_TIMEOUT_MS — open-sse executors read env at request time, so a
 * save must take effect without a restart. Bounds (10s–600s) are enforced at
 * the PATCH boundary and again in getFetchConnectTimeoutMs.
 */
const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn(async (body) => ({ ...body })),
}));
vi.mock("@/lib/localDb", () => mocks);
vi.mock("@/lib/network/outboundProxy", () => ({ applyOutboundProxyEnv: vi.fn() }));
vi.mock("open-sse/services/combo.js", () => ({ resetComboRotation: vi.fn() }));

const { PATCH } = await import("../../src/app/api/settings/route.js");
const { applyFetchTimeoutEnv } = await import("../../src/lib/fetchTimeoutEnv.js");
const {
  getFetchConnectTimeoutMs,
  FETCH_CONNECT_TIMEOUT_MIN_MS,
  FETCH_CONNECT_TIMEOUT_MAX_MS,
} = await import("../../open-sse/config/runtimeConfig.js");

const patch = (body) =>
  PATCH(new Request("http://localhost/api/settings", { method: "PATCH", body: JSON.stringify(body) }));

const savedEnv = process.env.FETCH_CONNECT_TIMEOUT_MS;
const restoreEnv = () => {
  if (savedEnv === undefined) delete process.env.FETCH_CONNECT_TIMEOUT_MS;
  else process.env.FETCH_CONNECT_TIMEOUT_MS = savedEnv;
};

describe("getFetchConnectTimeoutMs", () => {
  afterEach(restoreEnv);

  it("falls back to 60000 when env is unset or junk", () => {
    delete process.env.FETCH_CONNECT_TIMEOUT_MS;
    expect(getFetchConnectTimeoutMs()).toBe(60000);
    process.env.FETCH_CONNECT_TIMEOUT_MS = "soon";
    expect(getFetchConnectTimeoutMs()).toBe(60000);
  });

  it("honors an env value inside the bounds", () => {
    process.env.FETCH_CONNECT_TIMEOUT_MS = "180000";
    expect(getFetchConnectTimeoutMs()).toBe(180000);
  });

  it("clamps env values into 10s..600s", () => {
    process.env.FETCH_CONNECT_TIMEOUT_MS = "5000";
    expect(getFetchConnectTimeoutMs()).toBe(FETCH_CONNECT_TIMEOUT_MIN_MS);
    process.env.FETCH_CONNECT_TIMEOUT_MS = "9999999";
    expect(getFetchConnectTimeoutMs()).toBe(FETCH_CONNECT_TIMEOUT_MAX_MS);
  });
});

describe("PATCH /api/settings fetchConnectTimeoutMs", () => {
  beforeEach(() => {
    mocks.updateSettings.mockClear();
    delete process.env.FETCH_CONNECT_TIMEOUT_MS;
  });
  afterEach(restoreEnv);

  it("stores a valid value and mirrors it into env", async () => {
    const res = await patch({ fetchConnectTimeoutMs: 180000 });
    expect(res.status).toBe(200);
    expect(mocks.updateSettings.mock.calls[0][0].fetchConnectTimeoutMs).toBe(180000);
    expect(process.env.FETCH_CONNECT_TIMEOUT_MS).toBe("180000");
  });

  it("rejects values below the floor with 400 and stores nothing", async () => {
    const res = await patch({ fetchConnectTimeoutMs: 5000 });
    expect(res.status).toBe(400);
    expect(mocks.updateSettings).not.toHaveBeenCalled();
    expect(process.env.FETCH_CONNECT_TIMEOUT_MS).toBeUndefined();
  });

  it("rejects values above the ceiling with 400", async () => {
    const res = await patch({ fetchConnectTimeoutMs: 900000 });
    expect(res.status).toBe(400);
    expect(mocks.updateSettings).not.toHaveBeenCalled();
  });

  it("rejects non-numeric input with 400", async () => {
    const res = await patch({ fetchConnectTimeoutMs: "soon" });
    expect(res.status).toBe(400);
    expect(mocks.updateSettings).not.toHaveBeenCalled();
  });

  it("leaves the setting alone when the request does not mention it", async () => {
    const res = await patch({ requireLogin: true });
    expect(res.status).toBe(200);
    expect(mocks.updateSettings.mock.calls[0][0]).not.toHaveProperty("fetchConnectTimeoutMs");
    expect(process.env.FETCH_CONNECT_TIMEOUT_MS).toBeUndefined();
  });
});

describe("applyFetchTimeoutEnv", () => {
  afterEach(restoreEnv);

  it("writes a valid number, clamped to bounds", () => {
    delete process.env.FETCH_CONNECT_TIMEOUT_MS;
    applyFetchTimeoutEnv({ fetchConnectTimeoutMs: 180000 });
    expect(process.env.FETCH_CONNECT_TIMEOUT_MS).toBe("180000");
    applyFetchTimeoutEnv({ fetchConnectTimeoutMs: 9999999 });
    expect(process.env.FETCH_CONNECT_TIMEOUT_MS).toBe(String(FETCH_CONNECT_TIMEOUT_MAX_MS));
  });

  it("is a no-op for a missing or non-number key so .env survives", () => {
    process.env.FETCH_CONNECT_TIMEOUT_MS = "120000";
    applyFetchTimeoutEnv({});
    expect(process.env.FETCH_CONNECT_TIMEOUT_MS).toBe("120000");
    applyFetchTimeoutEnv({ fetchConnectTimeoutMs: "60000" });
    expect(process.env.FETCH_CONNECT_TIMEOUT_MS).toBe("120000");
    applyFetchTimeoutEnv({ fetchConnectTimeoutMs: null });
    expect(process.env.FETCH_CONNECT_TIMEOUT_MS).toBe("120000");
  });
});
