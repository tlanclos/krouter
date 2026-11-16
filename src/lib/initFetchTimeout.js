import { exportSettings } from "@/lib/localDb";
import { applyFetchTimeoutEnv } from "@/lib/fetchTimeoutEnv";

let initialized = false;

/**
 * Re-apply the saved connect-timeout knob after a restart (env does not survive
 * the process). Reads the RAW settings row — only when the knob has actually
 * been saved does it win, so a hand-set FETCH_CONNECT_TIMEOUT_MS in .env keeps
 * working until the dashboard knob is used. Mirrors initOutboundProxy.js.
 */
export async function ensureFetchTimeoutInitialized() {
  if (initialized) return true;
  try {
    applyFetchTimeoutEnv(await exportSettings());
    initialized = true;
  } catch (error) {
    console.error("[ServerInit] Error initializing fetch connect timeout:", error);
  }
  return initialized;
}

// Defer init so HTTP server accepts connections first
setImmediate(() => {
  ensureFetchTimeoutInitialized().catch(console.log);
});

export default ensureFetchTimeoutInitialized;
