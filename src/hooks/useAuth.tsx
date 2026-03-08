import { useEffect, useState, createContext, useContext, ReactNode, useCallback, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const initialised = useRef(false);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("[Auth] Failed to fetch profile:", error);
        return null;
      }
      return data;
    } catch (e) {
      console.error("[Auth] Exception fetching profile:", e);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const currentUser = supabase.auth.getUser ? undefined : undefined;
    // Use the ref-stable user from supabase directly
    const { data } = await supabase.auth.getUser();
    if (!data?.user) return;
    const nextProfile = await fetchProfile(data.user.id);
    setProfile(nextProfile);
  }, [fetchProfile]);

  // Single source of truth: onAuthStateChange drives all state
  useEffect(() => {
    let isMounted = true;

    // Step 1: Subscribe to auth changes FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!isMounted) return;
        console.log("[Auth] onAuthStateChange:", _event, nextSession?.user?.id ?? "no user");
        setSession(nextSession);
        setUser(nextSession?.user ?? null);

        if (!nextSession?.user) {
          setProfile(null);
        }

        // Mark as no longer loading once we have a definitive answer
        setLoading(false);
        initialised.current = true;
      }
    );

    // Step 2: Kick-start by getting the current session
    // This triggers onAuthStateChange with INITIAL_SESSION event
    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;
      if (error) {
        console.error("[Auth] getSession error:", error);
        setLoading(false);
        initialised.current = true;
      }
      // If onAuthStateChange hasn't fired yet (unlikely but possible),
      // ensure we don't stay stuck
      setTimeout(() => {
        if (isMounted && !initialised.current) {
          console.warn("[Auth] Fallback: forcing loading=false");
          setSession(data?.session ?? null);
          setUser(data?.session?.user ?? null);
          if (!data?.session?.user) setProfile(null);
          setLoading(false);
          initialised.current = true;
        }
      }, 3000);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Load profile whenever user changes
  useEffect(() => {
    let cancelled = false;

    if (user) {
      fetchProfile(user.id).then((p) => {
        if (!cancelled) setProfile(p);
      });
    } else {
      setProfile(null);
    }

    return () => { cancelled = true; };
  }, [user?.id, fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
