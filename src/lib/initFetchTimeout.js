import { exportSettings } from "@/lib/localDb";
import { applyFetchTimeoutSetting } from "@/lib/fetchTimeoutSetting";

let initialized = false;

/**
 * Re-apply the saved connect-timeout knob after a restart (the in-process store
 * does not survive the process). Reads the RAW settings row — only when the
 * knob has actually been saved does it win. Mirrors initOutboundProxy.js.
 */
export async function ensureFetchTimeoutInitialized() {
  if (initialized) return true;
  try {
    applyFetchTimeoutSetting(await exportSettings());
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
