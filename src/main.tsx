// Patch env vars from index.html fallback BEFORE any module imports Supabase
if (!import.meta.env.VITE_SUPABASE_URL && (window as any).__SUPABASE_URL__) {
  (import.meta.env as any).VITE_SUPABASE_URL = (window as any).__SUPABASE_URL__;
}
if (!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY && (window as any).__SUPABASE_KEY__) {
  (import.meta.env as any).VITE_SUPABASE_PUBLISHABLE_KEY = (window as any).__SUPABASE_KEY__;
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
