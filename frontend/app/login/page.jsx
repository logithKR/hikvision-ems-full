import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { loginUser, loginWithGoogle } from '@/lib/auth';
import AuthLayout from '@/components/layout/AuthLayout';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, Lock, EyeOff, Eye, ArrowRight } from "lucide-react";
import { auth, signInWithPopup, GoogleAuthProvider, signInWithCustomToken } from '@/lib/firebaseClient';

export default function UnifiedLoginPage() {
  const getApiBase = () => import.meta.env.VITE_API_URL || "";
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [googleToken, setGoogleToken] = useState(null); // Used if google auth is chosen
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authMethod, setAuthMethod] = useState(null); // 'manual' or 'google'
  const navigate = useNavigate();

  // Route based on role
  const navigateToDashboard = (userRole) => {
    if (userRole === 'system_admin') navigate('/system-admin/dashboard');
    else if (userRole === 'business_owner') navigate('/business-owner/dashboard');
    else if (userRole === 'admin') navigate('/admin/dashboard');
    else navigate('/employee/dashboard');
  };

  const fetchWorkspaces = async (targetEmail, token = null, method = 'manual') => {
    setLoading(true);
    try {
      const response = await fetch(`${getApiBase()}/api/auth/workspaces?email=${encodeURIComponent(targetEmail)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch workspaces');
      }

      if (data.workspaces.length === 0) {
        toast.error('No account found with this email address.');
        setLoading(false);
        return;
      }

      setWorkspaces(data.workspaces);
      setAuthMethod(method);

      // If only one workspace (or system admin), auto-select and proceed
      if (data.workspaces.length === 1) {
        const orgId = data.workspaces[0].id;
        setSelectedOrgId(orgId);
        
        if (method === 'google') {
          // Immediately login using Google token
          await executeGoogleLogin(token, orgId);
        } else {
          // Move to password step
          setStep(3);
        }
      } else {
        // Multiple workspaces: user needs to select one
        setStep(2);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      if (method === 'manual') setLoading(false);
    }
  };

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    if (!email) return toast.error('Please enter your email address');
    fetchWorkspaces(email, null, 'manual');
  };

  const handleGoogleAuth = async () => {
    // DO NOT set state before calling popup to avoid browser popup blockers!
    try {
      if (!auth) throw new Error("Firebase auth not initialized");
      
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account' // Always show account chooser
      });
      
      const result = await signInWithPopup(auth, provider);
      
      // Now it's safe to set loading state
      setLoading(true);
      
      const user = result.user;
      const idToken = await user.getIdToken();
      const userEmail = user.email;
      
      setEmail(userEmail);
      setGoogleToken(idToken);
      await fetchWorkspaces(userEmail, idToken, 'google');
      
    } catch (error) {
      console.error(error);
      toast.error("Google Authentication failed");
      setLoading(false);
    }
  };

  const executeGoogleLogin = async (token, orgId) => {
    try {
      const orgIdToPass = orgId === 'system' ? null : orgId;
      
      const response = await fetch(`${getApiBase()}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token, organizationId: orgIdToPass }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || 'Google Login failed on backend');
      }

      const data = await response.json();
      
      let finalToken = data.token;
      
      // We must sign into Firebase locally with the custom token to get the proper claims
      if (auth && data.token) {
        try {
          const userCredential = await signInWithCustomToken(auth, data.token);
          finalToken = await userCredential.user.getIdToken();
          console.log('🔥 Auth: Firebase authentication successful with custom token');
        } catch (firebaseError) {
          console.warn('⚠️ Auth: Firebase custom token sign-in failed:', firebaseError.message);
        }
      }

      // Store auth data
      import('@/lib/auth').then(({ storeAuthData }) => {
        storeAuthData({
          isLoggedIn: true,
          token: finalToken,
          user: data.user
        });
      });

      toast.success('Login successful!');
      navigateToDashboard(data.user.role);
    } catch (error) {
      toast.error(error.message);
      setLoading(false);
    }
  };

  const handleWorkspaceSelect = async (orgId) => {
    setSelectedOrgId(orgId);
    
    if (authMethod === 'google') {
      setLoading(true);
      await executeGoogleLogin(googleToken, orgId);
    } else {
      setStep(3);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!password) return toast.error('Please enter your password');

    setLoading(true);
    try {
      const orgIdToPass = selectedOrgId === 'system' ? null : selectedOrgId;
      const result = await loginUser(email, password, orgIdToPass);

      if (!result.success) {
        throw new Error(result.error || 'Invalid credentials');
      }

      toast.success('Login successful!');
      navigateToDashboard(result.user.role);

    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Sign in to your EMS account"
      role="employee"
    >
      <div className="mt-8 space-y-6">
        
        {/* STEP 1: EMAIL or GOOGLE */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12 border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                    placeholder="you@example.com"
                    disabled={loading}
                    required
                  />
                </div>
              </div>
              
              <Button
                type="submit"
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm rounded-xl transition-all"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>Continue <ArrowRight className="ml-2 h-4 w-4" /></>
                )}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-500 font-medium">
                  Or continue with
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleAuth}
              disabled={loading}
              className="w-full h-12 bg-white hover:bg-slate-50 text-slate-700 border-slate-200 rounded-xl font-medium shadow-sm flex items-center justify-center gap-3 transition-all"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Google
            </Button>
          </div>
        )}

        {/* STEP 2: WORKSPACE SELECTION */}
        {step === 2 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-right-2">
            <div className="text-center">
              <p className="text-sm text-slate-600 bg-slate-50 py-2 px-3 rounded-lg border border-slate-100 inline-block mb-2">
                Signed in as <span className="font-bold text-slate-900">{email}</span>
              </p>
              <h3 className="text-lg font-bold text-slate-900 mt-2">Select your Workspace</h3>
            </div>
            
            <div className="space-y-3 mt-4">
              {workspaces.map(org => (
                <button
                  key={org.id}
                  onClick={() => handleWorkspaceSelect(org.id)}
                  disabled={loading}
                  className="w-full p-4 border border-slate-200 rounded-xl flex items-center justify-between hover:border-blue-500 hover:bg-blue-50 transition-all group text-left bg-white"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-900 group-hover:text-blue-700">
                      {org.name} <span className="text-slate-400 font-normal text-xs ml-1">(ID: {org.id})</span>
                    </span>
                    <span className="text-xs text-slate-500 font-medium capitalize mt-1 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Role: {org.role.replace('_', ' ')}
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transform group-hover:translate-x-1 transition-transform" />
                </button>
              ))}
            </div>

            <button 
              onClick={() => { setStep(1); setAuthMethod(null); }} 
              disabled={loading}
              className="mt-6 text-sm text-slate-500 hover:text-slate-700 font-medium w-full text-center py-2"
            >
              ← Use a different account
            </button>
          </div>
        )}

        {/* STEP 3: PASSWORD (Only for manual email) */}
        {step === 3 && (
          <form onSubmit={handlePasswordSubmit} className="space-y-6 animate-in fade-in slide-in-from-right-2">
            <div className="text-center">
              <p className="text-sm text-slate-600 bg-slate-50 py-2 px-3 rounded-lg border border-slate-100 inline-block mb-2">
                Workspace: <span className="font-bold text-slate-900">
                  {workspaces.find(w => w.id === selectedOrgId)?.name || 'System'}
                </span>
              </p>
              <h3 className="text-lg font-bold text-slate-900 mt-2">Enter your Password</h3>
            </div>

            <div className="space-y-2 mt-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-12 border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                  placeholder="••••••••"
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-sm transition-all"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Sign In securely"
              )}
            </Button>

            <button 
              type="button"
              onClick={() => {
                setPassword('');
                setStep(workspaces.length > 1 ? 2 : 1);
              }} 
              disabled={loading}
              className="mt-6 text-sm text-slate-500 hover:text-slate-700 font-medium w-full text-center py-2"
            >
              ← Back
            </button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
