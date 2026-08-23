import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { Droplets, Eye, EyeOff, ArrowRight, ShieldCheck, Mail, Lock, User as UserIcon, CheckCircle2 } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { loginWithEmail, registerWithEmail, loginWithGoogle, sendPasswordReset, loading } = useAuth();

  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [isResettingPassword, setIsResettingPassword] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email || !password) {
      setErrorMsg('Please provide both email and password.');
      return;
    }

    if (isSignUp) {
      if (!name.trim()) {
        setErrorMsg('Please enter your full name.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match.');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters.');
        return;
      }

      try {
        await registerWithEmail(name, email, password);
      } catch (err: any) {
        setErrorMsg(err.message || 'Unable to create account. Please try again.');
      }
    } else {
      try {
        await loginWithEmail(email, password);
      } catch (err: any) {
        setErrorMsg(err.message || 'Invalid credentials. If you are a new user, please click "Sign Up" below.');
      }
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setErrorMsg(err.message || 'Google sign-in was cancelled.');
    }
  };

  const handleForgotPassword = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!email.trim()) {
      setErrorMsg('Please enter your email address to receive password reset instructions.');
      return;
    }

    try {
      await sendPasswordReset(email);
      setSuccessMsg(`Password reset instructions sent to ${email.trim()}.`);
      setIsResettingPassword(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to send password reset email.');
    }
  };

  return (
    <div className="min-h-screen bg-[#090B0E] flex items-center justify-center p-3.5 xs:p-4 sm:p-6 select-none relative overflow-hidden text-[#F8FAFC]">
      {/* Background ambient gradient */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] sm:w-[500px] h-[450px] sm:h-[500px] bg-[#00D1FF]/5 rounded-full blur-[120px] sm:blur-[140px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-[#12161C] border border-white/5 rounded-[28px] sm:rounded-[32px] p-5 xs:p-6 sm:p-8 shadow-2xl z-10 my-auto"
      >
        {/* Brand Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#00D1FF]/10 border border-[#00D1FF]/20 shadow-xl shadow-[#00D1FF]/10 mx-auto mb-3 sm:mb-4 flex items-center justify-center">
            <Droplets className="w-6 h-6 sm:w-7 sm:h-7 text-[#00D1FF]" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">
            AquaSense X
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            {isSignUp ? 'Create your smart hydration account' : 'Sign in to monitor your water quality'}
          </p>
        </div>

        {/* Error Alert */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 sm:mb-5 p-3 sm:p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex flex-col gap-2"
            >
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
              {!isSignUp && (
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(true);
                    setErrorMsg('');
                  }}
                  className="self-start mt-0.5 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 rounded-xl text-[11px] font-medium transition-colors touch-target sm:min-h-0"
                >
                  Switch to Sign Up
                </button>
              )}
            </motion.div>
          )}

          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 sm:mb-5 p-3 sm:p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  className="w-full bg-[#090B0E] border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 sm:py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#00D1FF]/50 transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-[#090B0E] border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 sm:py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#00D1FF]/50 transition-colors"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-neutral-400">
                Password
              </label>
              {!isSignUp && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-[#00D1FF] hover:underline touch-target sm:min-h-0 sm:min-w-0"
                >
                  Forgot?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#090B0E] border border-white/10 rounded-2xl pl-10 pr-10 py-2.5 sm:py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#00D1FF]/50 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {isSignUp && (
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#090B0E] border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 sm:py-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#00D1FF]/50 transition-colors"
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 px-4 rounded-2xl bg-[#00D1FF] hover:bg-[#00B4D8] text-[#090B0E] font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#00D1FF]/20 active:scale-98 transition-all disabled:opacity-50 touch-target"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-[#090B0E] border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>{isSignUp ? 'Create Account' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="my-5 sm:my-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-white/5" />
          <span className="text-[11px] text-neutral-500 uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-white/5" />
        </div>

        {/* Google Sign-In */}
        <button
          type="button"
          onClick={handleGoogleAuth}
          disabled={loading}
          className="w-full py-3 px-4 rounded-2xl bg-[#090B0E] border border-white/10 hover:bg-white/[0.04] text-[#F8FAFC] text-xs font-medium flex items-center justify-center gap-2.5 transition-colors touch-target"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        {/* Toggle sign up / sign in */}
        <div className="mt-5 sm:mt-6 text-center text-xs text-neutral-400">
          {isSignUp ? 'Already have an account?' : "Don't have an account yet?"}{' '}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className="text-[#00D1FF] font-medium hover:underline ml-1 touch-target sm:min-h-0 sm:min-w-0"
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
