import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store/store';
import { authService } from '../services/AuthService';

export const useAuth = () => {
  const auth = useSelector((state: RootState) => state.auth);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    return authService.signUp(email, password, displayName);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    return authService.signIn(email, password);
  }, []);

  const signOut = useCallback(async () => {
    return authService.signOut();
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    return authService.resetPassword(email);
  }, []);

  return {
    user: auth.user,
    isAuthenticated: !!auth.user,
    isLoading: auth.isLoading,
    isInitialized: auth.isInitialized,
    error: auth.error,
    signUp,
    signIn,
    signOut,
    resetPassword,
  };
};
