import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The Endpoint page's upstream connect-timeout knob is stored as
 * settings.fetchConnectTimeoutMs. Like every other setting it travels the same
 * route: the UI PATCHes /api/settings, the route stores it with
 * updateSettings(), and each request reads it with getSettings() and passes it
 * down to the provider call. The settings repo owns the field: it supplies the
 * default and clamps the stored value into the supported range on read.
 */
const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn(async (body) => ({ ...body })),
}));
vi.mock('@/lib/localDb', () => mocks);
vi.mock('@/lib/network/outboundProxy', () => ({ applyOutboundProxyEnv: vi.fn() }));
vi.mock('open-sse/services/combo.js', () => ({ resetComboRotation: vi.fn() }));

const { PATCH } = await import('../../src/app/api/settings/route.js');
const {
  resolveFetchConnectTimeoutMs,
  FETCH_CONNECT_TIMEOUT_DEFAULT_MS,
  FETCH_CONNECT_TIMEOUT_MIN_MS,
  FETCH_CONNECT_TIMEOUT_MAX_MS,
} = await import('../../open-sse/config/runtimeConfig.js');

const patch = (body) =>
  PATCH(new Request('http://localhost/api/settings', { method: 'PATCH', body: JSON.stringify(body) }));

beforeEach(() => {
  mocks.updateSettings.mockClear();
});

describe('resolveFetchConnectTimeoutMs', () => {
  it('returns the default when the setting is missing', () => {
    expect(resolveFetchConnectTimeoutMs(undefined)).toBe(FETCH_CONNECT_TIMEOUT_DEFAULT_MS);
  });

  it('returns the default when the setting is not a number', () => {
    expect(resolveFetchConnectTimeoutMs('60000')).toBe(FETCH_CONNECT_TIMEOUT_DEFAULT_MS);
  });

  it('returns a saved value inside the bounds', () => {
    expect(resolveFetchConnectTimeoutMs(180000)).toBe(180000);
  });

  it('clamps a saved value below the floor up to it', () => {
    expect(resolveFetchConnectTimeoutMs(5000)).toBe(FETCH_CONNECT_TIMEOUT_MIN_MS);
  });

  it('clamps a saved value above the ceiling down to it', () => {
    expect(resolveFetchConnectTimeoutMs(9999999)).toBe(FETCH_CONNECT_TIMEOUT_MAX_MS);
  });
});

describe('PATCH /api/settings fetchConnectTimeoutMs', () => {
  it('stores a valid value', async () => {
    const body = { fetchConnectTimeoutMs: 180000 };

    await patch(body);

    expect(mocks.updateSettings.mock.calls[0][0].fetchConnectTimeoutMs).toBe(180000);
  });

  it('responds 200 to a valid value', async () => {
    const body = { fetchConnectTimeoutMs: 180000 };

    const res = await patch(body);

    expect(res.status).toBe(200);
  });

  it('responds 200 to a value outside the bounds', async () => {
    const body = { fetchConnectTimeoutMs: 900000 };

    const res = await patch(body);

    expect(res.status).toBe(200);
  });

  it('stores whatever the request mentions', async () => {
    const body = { fetchConnectTimeoutMs: 900000 };

    await patch(body);

    expect(mocks.updateSettings.mock.calls[0][0].fetchConnectTimeoutMs).toBe(900000);
  });

  it('responds 200 when the request does not mention the setting', async () => {
    const body = { requireLogin: true };

    const res = await patch(body);

    expect(res.status).toBe(200);
  });

  it('leaves the setting alone when the request does not mention it', async () => {
    const body = { requireLogin: true };

    await patch(body);

    expect(mocks.updateSettings.mock.calls[0][0]).not.toHaveProperty('fetchConnectTimeoutMs');
  });
});
