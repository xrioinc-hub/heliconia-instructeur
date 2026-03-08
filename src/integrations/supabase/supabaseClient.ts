import { supabase as autoClient } from "./client";

// Re-export the auto-generated client.
// If the auto-generated client fails (missing env vars in prod),
// this file can be extended with a fallback.
// For now, we simply re-export.
export { autoClient as supabase };
