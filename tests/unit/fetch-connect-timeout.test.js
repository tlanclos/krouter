import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The Endpoint page's upstream connect-timeout knob is stored as
 * settings.fetchConnectTimeoutMs and written into env
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
  clampFetchConnectTimeoutMs,
  FETCH_CONNECT_TIMEOUT_DEFAULT_MS,
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

  it("returns the default when the env var is unset", () => {
    delete process.env.FETCH_CONNECT_TIMEOUT_MS;

    const timeoutMs = getFetchConnectTimeoutMs();

    expect(timeoutMs).toBe(FETCH_CONNECT_TIMEOUT_DEFAULT_MS);
  });

  it("returns the default when the env var is not a number", () => {
    process.env.FETCH_CONNECT_TIMEOUT_MS = "soon";

    const timeoutMs = getFetchConnectTimeoutMs();

    expect(timeoutMs).toBe(FETCH_CONNECT_TIMEOUT_DEFAULT_MS);
  });

  it("honors an env value inside the bounds", () => {
    process.env.FETCH_CONNECT_TIMEOUT_MS = "180000";

    const timeoutMs = getFetchConnectTimeoutMs();

    expect(timeoutMs).toBe(180000);
  });

  it("clamps an env value below the floor up to it", () => {
    process.env.FETCH_CONNECT_TIMEOUT_MS = "5000";

    const timeoutMs = getFetchConnectTimeoutMs();

    expect(timeoutMs).toBe(FETCH_CONNECT_TIMEOUT_MIN_MS);
  });

  it("clamps an env value above the ceiling down to it", () => {
    process.env.FETCH_CONNECT_TIMEOUT_MS = "9999999";

    const timeoutMs = getFetchConnectTimeoutMs();

    expect(timeoutMs).toBe(FETCH_CONNECT_TIMEOUT_MAX_MS);
  });
});

describe("clampFetchConnectTimeoutMs", () => {
  it("leaves a value inside the bounds untouched", () => {
    const ms = 180000;

    const clamped = clampFetchConnectTimeoutMs(ms);

    expect(clamped).toBe(180000);
  });

  it("clamps a value below the floor up to it", () => {
    const ms = 5000;

    const clamped = clampFetchConnectTimeoutMs(ms);

    expect(clamped).toBe(FETCH_CONNECT_TIMEOUT_MIN_MS);
  });

  it("clamps a value above the ceiling down to it", () => {
    const ms = 9999999;

    const clamped = clampFetchConnectTimeoutMs(ms);

    expect(clamped).toBe(FETCH_CONNECT_TIMEOUT_MAX_MS);
  });
});

describe("PATCH /api/settings fetchConnectTimeoutMs", () => {
  beforeEach(() => {
    mocks.updateSettings.mockClear();
    delete process.env.FETCH_CONNECT_TIMEOUT_MS;
  });
  afterEach(restoreEnv);

  it("stores a valid value", async () => {
    const body = { fetchConnectTimeoutMs: 180000 };

    await patch(body);

    expect(mocks.updateSettings.mock.calls[0][0].fetchConnectTimeoutMs).toBe(180000);
  });

  it("writes a valid value into env", async () => {
    const body = { fetchConnectTimeoutMs: 180000 };

    await patch(body);

    expect(process.env.FETCH_CONNECT_TIMEOUT_MS).toBe("180000");
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

  it("leaves env untouched for a value below the floor", async () => {
    const body = { fetchConnectTimeoutMs: 5000 };

    await patch(body);

    expect(process.env.FETCH_CONNECT_TIMEOUT_MS).toBeUndefined();
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

  it("leaves the setting alone when the request does not mention it", async () => {
    const body = { requireLogin: true };

    await patch(body);

    expect(mocks.updateSettings.mock.calls[0][0]).not.toHaveProperty("fetchConnectTimeoutMs");
  });

  it("leaves env untouched when the request does not mention the setting", async () => {
    const body = { requireLogin: true };

    await patch(body);

    expect(process.env.FETCH_CONNECT_TIMEOUT_MS).toBeUndefined();
  });
});

describe("applyFetchTimeoutEnv", () => {
  afterEach(restoreEnv);

  it("writes a valid number to env", () => {
    delete process.env.FETCH_CONNECT_TIMEOUT_MS;

    applyFetchTimeoutEnv({ fetchConnectTimeoutMs: 180000 });

    expect(process.env.FETCH_CONNECT_TIMEOUT_MS).toBe("180000");
  });

  it("clamps a number above the ceiling when writing", () => {
    delete process.env.FETCH_CONNECT_TIMEOUT_MS;

    applyFetchTimeoutEnv({ fetchConnectTimeoutMs: 9999999 });

    expect(process.env.FETCH_CONNECT_TIMEOUT_MS).toBe(String(FETCH_CONNECT_TIMEOUT_MAX_MS));
  });

  it("is a no-op when the setting is missing", () => {
    process.env.FETCH_CONNECT_TIMEOUT_MS = "120000";

    applyFetchTimeoutEnv({});

    expect(process.env.FETCH_CONNECT_TIMEOUT_MS).toBe("120000");
  });

  it("is a no-op when the setting is not a number", () => {
    process.env.FETCH_CONNECT_TIMEOUT_MS = "120000";

    applyFetchTimeoutEnv({ fetchConnectTimeoutMs: "60000" });

    expect(process.env.FETCH_CONNECT_TIMEOUT_MS).toBe("120000");
  });

  it("is a no-op when the setting is null", () => {
    process.env.FETCH_CONNECT_TIMEOUT_MS = "120000";

    applyFetchTimeoutEnv({ fetchConnectTimeoutMs: null });

    expect(process.env.FETCH_CONNECT_TIMEOUT_MS).toBe("120000");
  });
});
