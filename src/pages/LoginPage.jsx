import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package, Lock, User, AlertCircle } from 'lucide-react';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, authError, setAuthError } = useAuth();
  
  const navigate = useNavigate();
  const location = useLocation();

  // Find the previous path or redirect to dashboard
  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setAuthError('Please fill in all fields.');
      return;
    }

    setIsLoading(true);
    // Simulate minor network delay
    setTimeout(() => {
      const success = login(username, password);
      setIsLoading(false);
      if (success) {
        navigate(from, { replace: true });
      }
    }, 600);
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between items-center bg-background px-4 py-8 relative overflow-hidden">
      {/* Ambient background glows using the project's primary color theme */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top flex spacer for vertical alignment */}
      <div className="flex-1" />

      <div className="w-full max-w-md space-y-6 z-10 my-auto">
        {/* Logo and Header */}
        <div className="flex flex-col items-center text-center">
          <div className="p-3 bg-primary text-primary-foreground rounded-2xl mb-4 shadow-md">
            <Package className="h-6 w-6" />
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground">
            Procure<span className="font-light text-muted-foreground">Flow</span>
          </h2>
          <p className="text-[10px] text-muted-foreground mt-1.5 tracking-widest uppercase">
            ENTERPRISE PURCHASING PORTAL
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-card text-card-foreground border border-border rounded-2xl shadow-xl shadow-neutral-200/20 dark:shadow-none p-6 md:p-10 mx-auto w-full">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Error Message */}
            {authError && (
              <div className="p-3 bg-destructive/5 border border-destructive/10 text-destructive rounded-xl flex items-start gap-2.5 text-xs animate-in fade-in slide-in-from-top-1 duration-200">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="leading-normal font-medium">{authError}</span>
              </div>
            )}

            {/* Username Input */}
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-xs font-semibold text-muted-foreground pl-0.5">
                Username
              </Label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="e.g. admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 h-11 rounded-xl bg-background border-input transition-all duration-200"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-muted-foreground pl-0.5">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-11 rounded-xl bg-background border-input transition-all duration-200"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-medium rounded-xl transition-all duration-200 active:scale-[0.98] shadow-sm cursor-pointer mt-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-primary-foreground" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Authenticating...
                </span>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* Bottom flex spacer with Footer inside */}
      <div className="flex-1 flex items-end justify-center z-10 w-full">
        <div className="text-xs text-muted-foreground pt-8 pb-4">
          <span className="flex items-center gap-1.5">
            Powered by{' '}
            <a 
              href="https://www.botivate.in" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="font-medium text-foreground hover:underline transition-colors"
            >
              Botivate
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
