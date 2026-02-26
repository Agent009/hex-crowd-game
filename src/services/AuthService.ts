import { supabase } from '../lib/supabase';
import { store } from '../store/store';
import {
  setUser,
  setAuthLoading,
  setAuthInitialized,
  setAuthError,
  clearAuth,
  AuthUser,
} from '../store/authSlice';

const mapSupabaseUser = (user: { id: string; email?: string; user_metadata?: { display_name?: string }; created_at?: string } | null): AuthUser | null => {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || '',
    displayName: user.user_metadata?.display_name || null,
    createdAt: user.created_at || new Date().toISOString(),
  };
};

class AuthService {
  private initialized = false;

  async initialize() {
    if (this.initialized) return;
    this.initialized = true;

    const { data: { session } } = await supabase.auth.getSession();
    store.dispatch(setUser(mapSupabaseUser(session?.user ?? null)));
    store.dispatch(setAuthInitialized(true));

    supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        store.dispatch(setUser(mapSupabaseUser(session?.user ?? null)));
      })();
    });
  }

  async signUp(email: string, password: string, displayName: string): Promise<{ success: boolean; error?: string }> {
    store.dispatch(setAuthLoading(true));
    store.dispatch(setAuthError(null));

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });

    store.dispatch(setAuthLoading(false));

    if (error) {
      store.dispatch(setAuthError(error.message));
      return { success: false, error: error.message };
    }

    if (data.user) {
      store.dispatch(setUser(mapSupabaseUser(data.user)));
    }

    return { success: true };
  }

  async signIn(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    store.dispatch(setAuthLoading(true));
    store.dispatch(setAuthError(null));

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    store.dispatch(setAuthLoading(false));

    if (error) {
      store.dispatch(setAuthError(error.message));
      return { success: false, error: error.message };
    }

    if (data.user) {
      store.dispatch(setUser(mapSupabaseUser(data.user)));
    }

    return { success: true };
  }

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
    store.dispatch(clearAuth());
    store.dispatch(setAuthInitialized(true));
  }

  async resetPassword(email: string): Promise<{ success: boolean; error?: string }> {
    store.dispatch(setAuthLoading(true));

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    store.dispatch(setAuthLoading(false));

    if (error) {
      store.dispatch(setAuthError(error.message));
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  getUser(): AuthUser | null {
    return store.getState().auth.user;
  }
}

export const authService = new AuthService();
