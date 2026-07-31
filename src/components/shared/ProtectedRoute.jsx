import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ProtectedRoute({ children, requiredPermission }) {
  const { currentUser } = useAuth();
  const location = useLocation();

  if (!currentUser) {
    // Redirect to login but save the current location they were trying to go to
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check page access permission if one is required
  if (requiredPermission && !currentUser.pageAccess.includes(requiredPermission)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="p-4 bg-destructive/5 text-destructive rounded-full mb-6">
          <ShieldAlert className="h-12 w-12" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 mb-2">
          Access Denied
        </h1>
        <p className="text-sm text-neutral-500 max-w-md mb-8">
          You do not have permission to access the <span className="font-semibold">{requiredPermission}</span> page. Please contact your administrator to request access.
        </p>
        <Button 
          variant="outline"
          onClick={() => window.history.back()}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </Button>
      </div>
    );
  }

  return children;
}
