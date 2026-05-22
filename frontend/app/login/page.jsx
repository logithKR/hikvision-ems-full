import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function UnifiedLoginPage() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [workspaces, setWorkspaces] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email) return toast.error('Please enter your email address');

    setLoading(true);
    try {
      const response = await fetch(`http://localhost:5000/api/auth/workspaces?email=${encodeURIComponent(email)}`);
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
      
      // If only one workspace (or system admin), auto-select and proceed to password
      if (data.workspaces.length === 1) {
        setSelectedOrgId(data.workspaces[0].id);
        setStep(3);
      } else {
        setStep(2);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWorkspaceSelect = (orgId) => {
    setSelectedOrgId(orgId);
    setStep(3);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!password) return toast.error('Please enter your password');

    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          organizationId: selectedOrgId === 'system' ? null : selectedOrgId
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Invalid credentials');
      }

      // Store token and redirect
      localStorage.setItem('token', data.token);
      toast.success('Login successful!');

      // Route based on role
      const userRole = data.user.role;
      if (userRole === 'system_admin') {
        navigate('/system-admin/dashboard');
      } else if (userRole === 'business_owner') {
        navigate('/business-owner/dashboard');
      } else if (userRole === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/employee/dashboard');
      }

    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden p-8 border border-gray-100">
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-lg shadow-blue-200">
            H
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Welcome Back</h2>
          <p className="text-sm text-gray-500 mt-2">Sign in to your account</p>
        </div>

        {/* STEP 1: EMAIL */}
        {step === 1 && (
          <form onSubmit={handleEmailSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none bg-gray-50 focus:bg-white"
                placeholder="you@example.com"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-70 flex justify-center"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              ) : 'Continue'}
            </button>
          </form>
        )}

        {/* STEP 2: WORKSPACE SELECTION */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <p className="text-sm text-gray-600">Select the workspace you want to sign in to for <span className="font-semibold text-gray-900">{email}</span></p>
            </div>
            
            <div className="space-y-3">
              {workspaces.map(org => (
                <button
                  key={org.id}
                  onClick={() => handleWorkspaceSelect(org.id)}
                  className="w-full p-4 border border-gray-200 rounded-xl flex items-center justify-between hover:border-blue-500 hover:bg-blue-50 transition-all group"
                >
                  <div className="flex flex-col text-left">
                    <span className="font-semibold text-gray-900 group-hover:text-blue-700">
                      {org.name} <span className="text-gray-400 font-normal text-xs ml-1">(ID: {org.id})</span>
                    </span>
                    <span className="text-xs text-gray-500 font-medium capitalize mt-0.5">
                      Role: {org.role.replace('_', ' ')}
                    </span>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>

            <button onClick={() => setStep(1)} className="mt-6 text-sm text-blue-600 hover:text-blue-800 font-medium w-full text-center">
              ← Use a different email
            </button>
          </div>
        )}

        {/* STEP 3: PASSWORD */}
        {step === 3 && (
          <form onSubmit={handlePasswordSubmit} className="space-y-6">
            <div className="text-center mb-6">
              <p className="text-sm text-gray-600">
                Signing into <span className="font-semibold text-gray-900">
                  {workspaces.find(w => w.id === selectedOrgId)?.name || 'Workspace'}
                </span>
                {selectedOrgId !== 'system' && (
                  <span className="text-gray-500 text-xs ml-1">(ID: {selectedOrgId})</span>
                )}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none bg-gray-50 focus:bg-white"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-70 flex justify-center"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              ) : 'Sign In'}
            </button>

            <button 
              type="button"
              onClick={() => {
                setPassword('');
                setStep(workspaces.length > 1 ? 2 : 1);
              }} 
              className="mt-6 text-sm text-blue-600 hover:text-blue-800 font-medium w-full text-center"
            >
              ← Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
