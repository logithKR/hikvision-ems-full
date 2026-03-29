'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/app/config/firebase';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getRoleRedirectPath, storeAuthData } from '@/lib/auth';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const getApiBase = () => {
    const url = import.meta.env.VITE_API_URL || 'http://localhost:3000'
    return url.endsWith('/api') ? url : `${url}/api`
}

export default function GoogleLoginButton({ role = null }) {
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { signInWithToken } = useAuth();

    const handleGoogleLogin = async () => {
        setLoading(true);
        try {
            // Create a fresh provider with account selection prompt
            const provider = new GoogleAuthProvider();
            provider.setCustomParameters({
                prompt: 'select_account' // Always show account chooser
            });

            // 1. Firebase Client Sign In (Pop-up)
            const result = await signInWithPopup(auth, provider);
            const idToken = await result.user.getIdToken();

            console.log('Got ID Token, sending to backend...');

            // 2. Send to Backend for verification and custom token
            const apiBase = getApiBase();
            const response = await fetch(`${apiBase}/auth/google`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Google Login failed');
            }

            console.log('✅ Backend verified user:', data.user.email);

            // 3. Verify Role if required
            // Allow system_admin to login anywhere
            if (role && data.user.role !== role && data.user.role !== 'system_admin') {
                throw new Error(`Access denied. You are logged in as ${data.user.role}, but this portal is for ${role}s.`);
            }

            // 4. Store auth data in sessionStorage (required for layout route guards)
            storeAuthData({
                isLoggedIn: true,
                token: data.token,
                user: data.user
            });

            // 5. Sign in with Custom Token (switches to EMS App User context)
            await signInWithToken(data.token);

            toast.success(`Welcome back, ${data.user.name}!`);

            // 6. Redirect based on role
            const redirectPath = getRoleRedirectPath(data.user.role);
            navigate(redirectPath);

        } catch (error) {
            console.error('Google Login Error:', error);

            // User-friendly error messages
            if (error.code === 'auth/popup-blocked') {
                toast.error('Popup was blocked. Please allow popups for this site and try again.');
            } else if (error.code === 'auth/popup-closed-by-user') {
                toast.info('Login cancelled.');
            } else if (error.code === 'auth/cancelled-popup-request') {
                // Ignore — user clicked the button multiple times
            } else {
                toast.error(error.message || 'Google login failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            type="button"
            variant="outline"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full relative bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
            {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <img
                    src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                    alt="Google"
                    className="w-5 h-5 mr-2"
                />
            )}
            Sign in with Google
        </Button>
    );
}
