import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The settings repo owns settings.fetchConnectTimeoutMs. Whatever a PATCH (or a
 * hand-edited settings row) puts in, getSettings() returns a value inside the
 * supported range — clamped if numeric, the default if unusable.
 */
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('../../src/lib/db/driver.js', () => ({
  getAdapter: vi.fn(async () => ({ get: mocks.get })),
}));

vi.mock('open-sse/services/capacityAdapter.js', () => ({
  isDeadPoolModel: vi.fn(() => false),
}));

const { getSettings } = await import('../../src/lib/db/repos/settingsRepo.js');
const {
  FETCH_CONNECT_TIMEOUT_DEFAULT_MS,
  FETCH_CONNECT_TIMEOUT_MIN_MS,
  FETCH_CONNECT_TIMEOUT_MAX_MS,
} = await import('../../open-sse/config/runtimeConfig.js');

const settingsWith = (stored) => {
  mocks.get.mockReturnValue({ data: JSON.stringify(stored) });
  return getSettings();
};

beforeEach(() => {
  mocks.get.mockReset();
});

describe('settingsRepo fetchConnectTimeoutMs', () => {
  it('returns the default when no row exists', async () => {
    mocks.get.mockReturnValue(undefined);

    const settings = await getSettings();

    expect(settings.fetchConnectTimeoutMs).toBe(FETCH_CONNECT_TIMEOUT_DEFAULT_MS);
  });

  it('returns the default when the stored value is missing', async () => {
    const settings = await settingsWith({});

    expect(settings.fetchConnectTimeoutMs).toBe(FETCH_CONNECT_TIMEOUT_DEFAULT_MS);
  });

  it('returns the default when the stored value is not a number', async () => {
    const settings = await settingsWith({ fetchConnectTimeoutMs: 'soon' });

    expect(settings.fetchConnectTimeoutMs).toBe(FETCH_CONNECT_TIMEOUT_DEFAULT_MS);
  });

  it('leaves a stored value inside the bounds untouched', async () => {
    const settings = await settingsWith({ fetchConnectTimeoutMs: 180000 });

    expect(settings.fetchConnectTimeoutMs).toBe(180000);
  });

  it('clamps a stored value below the floor up to it', async () => {
    const settings = await settingsWith({ fetchConnectTimeoutMs: 5000 });

    expect(settings.fetchConnectTimeoutMs).toBe(FETCH_CONNECT_TIMEOUT_MIN_MS);
  });

  it('clamps a stored value above the ceiling down to it', async () => {
    const settings = await settingsWith({ fetchConnectTimeoutMs: 9999999 });

    expect(settings.fetchConnectTimeoutMs).toBe(FETCH_CONNECT_TIMEOUT_MAX_MS);
  });
});
