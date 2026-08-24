import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export interface SessionState {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

/** Client-side auth state, kept in sync with Supabase's session store. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ session: null, user: null, loading: true });

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setState({ session: data.session, user: data.session?.user ?? null, loading: false });
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState({ session, user: session?.user ?? null, loading: false });
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return state;
}
