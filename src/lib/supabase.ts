import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Robust production fallback: if build-time env injection fails,
// keep the app functional with safe public credentials.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://kflysnjjabkrlgedbxnu.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmbHlzbmpqYWJrcmxnZWRieG51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MDE0NDIsImV4cCI6MjA4ODQ3NzQ0Mn0.GEzCFr_Mhd9RkkwmK9WOHKXce8Kui8EhKk4xyS4BRBk";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
