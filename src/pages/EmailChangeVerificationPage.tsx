import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader, Mail, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { insertEmailChangeAudit } from '../utils/supabaseInserts';

const EmailChangeVerificationPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Function to sign out all sessions across devices
  const signOutAllSessions = async () => {
    try {
      console.log('🔐 Signing out all sessions across devices...');
      
      // This will sign out the user from ALL devices and browsers
      // by invalidating all refresh tokens associated with the user
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      
      if (error) {
        console.error('❌ Error signing out all sessions:', error);
      } else {
        console.log('✅ Successfully signed out all sessions globally');
      }
    } catch (error) {
      console.error('💥 Error during global sign out:', error);
    }
  };
  useEffect(() => {
    const verifyEmailChange = async () => {
      try {
        // Use edge function for verification
        const currentUrl = window.location.href;
        const verificationUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-verification${window.location.search}`;
        
        console.log('🔗 Redirecting to verification handler:', verificationUrl);
        
        // Redirect to the edge function which will handle verification and redirect back
        window.location.href = verificationUrl;
        
      } catch (error) {
        console.error('💥 Verification error:', error);
        setStatus('error');
        setMessage(`An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}. Please try logging in with your new email address.`);
      }
    };

    verifyEmailChange();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pt-24 pb-16 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-md overflow-hidden">
          <div className={`p-6 text-white text-center ${
            status === 'success' ? 'bg-green-600' : 
            status === 'error' ? 'bg-red-600' : 'bg-blue-600'
          }`}>
            <div className="flex justify-center mb-4">
              {status === 'verifying' && <Loader className="h-12 w-12 animate-spin" />}
              {status === 'success' && <CheckCircle className="h-12 w-12" />}
              {status === 'error' && <XCircle className="h-12 w-12" />}
            </div>
            <h1 className="text-2xl font-bold">
              {status === 'verifying' && 'Verifying Email Change'}
              {status === 'success' && 'Email Changed Successfully'}
              {status === 'error' && 'Verification Failed'}
            </h1>
          </div>
          
          <div className="p-8">
            {status === 'verifying' && (
              <div className="text-center">
                <p className="text-slate-600 dark:text-slate-400 mb-4">
                  Please wait while we verify your email change...
                </p>
                <div className="animate-pulse">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mx-auto mb-2"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mx-auto"></div>
                </div>
              </div>
            )}

            {status === 'success' && (
              <div className="text-center">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-center mb-2">
                    <Mail className="h-5 w-5 text-green-600 dark:text-green-400 mr-2" />
                    <span className="font-medium text-green-800 dark:text-green-300">
                      Email Successfully Updated
                    </span>
                  </div>
                  {newEmail && (
                    <p className="text-green-700 dark:text-green-400 text-sm">
                      Your new email address: <strong>{newEmail}</strong>
                    </p>
                  )}
                </div>
                
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  {message}
                </p>
                
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2 mt-0.5" />
                    <div className="text-sm text-blue-800 dark:text-blue-300">
                      <p className="font-medium mb-1">Next Steps:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>You'll be redirected to the login page automatically</li>
                        <li>Use your new email address to log in</li>
                        <li>Your password remains the same</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Redirecting to login page in a few seconds...
                </p>
              </div>
            )}

            {status === 'error' && (
              <div className="text-center">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
                  <p className="text-red-800 dark:text-red-300 font-medium mb-2">
                    Verification Failed
                  </p>
                  <p className="text-red-700 dark:text-red-400 text-sm">
                    {message}
                  </p>
                </div>

                <div className="space-y-3">
                  <button
                    onClick={() => {
                      navigate('/admin/login?verification_failed=1');
                    }}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Go to Login Page
                  </button>
                </div>

                <div className="mt-6 text-center">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Please use the button above to go to the login page and try again.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailChangeVerificationPage;