/**
 * contexts/AuthContext.jsx
 * Authentication context provider for managing user state
 */

'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged,
  signInWithCustomToken,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { auth } from '@/app/config/firebase';
import { getCurrentUser } from '@/lib/api';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Listen to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          console.log('🔐 Firebase user detected:', firebaseUser.uid);
          
          // Get ID token
          const token = await firebaseUser.getIdToken();
          
          // Decode the token to check for custom claims (organizationId or role)
          // If neither exists, this is a raw Google/social sign-in that hasn't been
          // exchanged for a custom token yet — skip the backend call and let
          // the login page handle the full flow.
          let hasCustomClaims = false;
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            hasCustomClaims = !!(payload.organizationId || payload.role);
          } catch (e) {
            // If we can't decode, assume we should try the backend
            hasCustomClaims = true;
          }

          if (!hasCustomClaims) {
            console.log('⏳ Firebase user has no custom claims yet (raw Google sign-in). Skipping backend /me call.');
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              firebaseUser,
              token,
              pendingCustomToken: true
            });
            setLoading(false);
            return;
          }

          // Fetch user data from backend
          try {
            const userData = await getCurrentUser(token);
            console.log('✅ User data loaded:', userData.user);
            
            setUser({
              ...userData.user,
              firebaseUser,
              token
            });
          } catch (error) {
            console.error('❌ Error fetching user data from backend:', error);
            
            // If backend fails, still set basic firebase user
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              firebaseUser,
              token,
              backendError: true
            });
          }
        } else {
          console.log('🔓 No Firebase user');
          setUser(null);
        }
      } catch (error) {
        console.error('❌ Auth state change error:', error);
        setError(error.message);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  /**
   * Sign in with custom token from backend
   */
  const signInWithToken = async (customToken) => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔐 Signing in with custom token...');
      
      const userCredential = await signInWithCustomToken(auth, customToken);
      console.log('✅ Signed in successfully:', userCredential.user.uid);
      
      return userCredential;
    } catch (error) {
      console.error('❌ Sign in error:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sign out
   */
  const signOut = async () => {
    try {
      setLoading(true);
      console.log('🔓 Signing out...');
      
      await firebaseSignOut(auth);
      setUser(null);
      
      console.log('✅ Signed out successfully');
    } catch (error) {
      console.error('❌ Sign out error:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Refresh user data from backend
   */
  const refreshUser = async () => {
    try {
      if (!user?.token) {
        console.warn('⚠️ No token available for refresh');
        return;
      }
      
      console.log('🔄 Refreshing user data...');
      const userData = await getCurrentUser(user.token);
      
      setUser({
        ...userData.user,
        firebaseUser: user.firebaseUser,
        token: user.token
      });
      
      console.log('✅ User data refreshed');
    } catch (error) {
      console.error('❌ Refresh user error:', error);
      setError(error.message);
    }
  };

  const value = {
    user,
    loading,
    error,
    signInWithToken,
    signOut,
    refreshUser,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to use auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export default AuthContext;
