import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { 
  DropdownMenu, 
  DropdownMenuTrigger, 
  DropdownMenuContent, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuItem 
} from '@/components/ui/dropdown-menu';

import { LogOut, ChevronRight, Menu } from 'lucide-react';

const LABEL_MAP = {
  'dashboard': 'Dashboard',
  'settings': 'Settings',
  'generate-po': 'Generate PO',
  'create-bill': 'Create Bill',
  'ready-product': 'Ready Product',
  'check-transport': 'Check Transport',
  'print-invoice': 'Print Invoice',
  'supply-check': 'Supply Check',
  'approve-product': 'Approve Product',
  'payment-processing': 'Payment Processing',
};

function formatLabel(segment) {
  return LABEL_MAP[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function Header({ onToggleSidebar }) {
  const { currentUser, logout } = useAuth();
  const location = useLocation();

  const getBreadcrumbs = () => {
    const path = location.pathname;
    if (path === '/') return [{ label: 'Dashboard', path: '/', active: true }];
    
    const paths = path.split('/').filter(Boolean);
    return [
      { label: 'ProcureFlow', path: '/', active: false },
      ...paths.map((p, index) => {
        const url = `/${paths.slice(0, index + 1).join('/')}`;
        return {
          label: formatLabel(p),
          path: url,
          active: index === paths.length - 1
        };
      })
    ];
  };

  const breadcrumbs = getBreadcrumbs();
  const userInitials = currentUser?.name
    ? currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase()
    : 'U';

  return (
    <header className="h-16 min-h-16 max-h-16 w-full border-b border-border bg-background/70 backdrop-blur-md px-4 md:px-6 flex items-center justify-between sticky top-0 z-40 overflow-hidden shrink-0">
      {/* Mobile Hamburger + Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-sm truncate">
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-1.5 -ml-1 mr-1 rounded-lg hover:bg-accent transition-colors cursor-pointer shrink-0"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5 text-foreground" />
        </button>
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={`${crumb.path}-${idx}`}>
            {idx > 0 && <ChevronRight className="hidden sm:inline h-3.5 w-3.5 text-muted-foreground" />}
            {crumb.active ? (
              <span className="font-medium text-foreground whitespace-nowrap">{crumb.label}</span>
            ) : (
              <Link 
                to={crumb.path} 
                className="hidden sm:inline text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              >
                {crumb.label}
              </Link>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* User Actions & Profile */}
      <div className="flex items-center gap-3 md:gap-4 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 p-1 rounded-full hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring transition-all text-left cursor-pointer">
              <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                {userInitials}
              </div>
              <div className="hidden md:flex flex-col pr-2">
                <span className="text-xs font-medium text-foreground leading-none mb-0.5">
                  {currentUser?.name}
                </span>
                <span className="text-[10px] text-muted-foreground leading-none">
                  {currentUser?.role}
                </span>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-1.5 border-border bg-card">
            <DropdownMenuLabel className="font-normal py-2.5 px-3">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none text-foreground">{currentUser?.name}</p>
                <p className="text-xs leading-none text-muted-foreground mt-0.5">{currentUser?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem 
              onClick={logout}
              className="py-2 px-3 text-xs text-destructive focus:bg-destructive/10 focus:text-destructive flex items-center gap-2 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
