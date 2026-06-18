import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { 
  LayoutDashboard, 
  Settings, 
  Package, 
  UserCheck, 
  Shield, 
  FileText,
  Receipt,
  PackageCheck,
  Truck,
  Printer,
  ClipboardCheck,
  CheckSquare,
  CreditCard 
} from 'lucide-react';

export function Sidebar() {
  const { currentUser } = useAuth();

  const navigationItems = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      permission: 'Dashboard'
    },
    {
      label: 'Generate PO',
      path: '/generate-po',
      icon: FileText,
      permission: 'Generate PO'
    },
    {
      label: 'Create Bill',
      path: '/create-bill',
      icon: Receipt,
      permission: 'Create Bill'
    },
    {
      label: 'Ready Product',
      path: '/ready-product',
      icon: PackageCheck,
      permission: 'Ready Product'
    },
    {
      label: 'Check Transport',
      path: '/check-transport',
      icon: Truck,
      permission: 'Check Transport'
    },
    {
      label: 'Print Invoice',
      path: '/print-invoice',
      icon: Printer,
      permission: 'Print Invoice'
    },
    {
      label: 'Supply Check',
      path: '/supply-check',
      icon: ClipboardCheck,
      permission: 'Supply Check'
    },
    {
      label: 'Approve Product',
      path: '/approve-product',
      icon: CheckSquare,
      permission: 'Approve Product'
    },
    {
      label: 'Payment Processing',
      path: '/payment-processing',
      icon: CreditCard,
      permission: 'Payment Processing'
    },
    {
      label: 'Settings',
      path: '/settings',
      icon: Settings,
      permission: 'Settings'
    }
  ];

  // Filter menu items by user's pageAccess permissions
  const visibleItems = navigationItems.filter(
    item => currentUser?.pageAccess?.includes(item.permission)
  );

  return (
    <>
      {/* Desktop Sidebar (visible on screens >= md) */}
      <aside className="hidden md:flex w-64 border-r border-border bg-card flex-col h-screen sticky top-0">
        {/* Brand Header */}
        <div className="h-16 px-6 border-b border-border flex items-center gap-2 bg-card">
          <div className="p-1.5 bg-primary text-primary-foreground rounded-xl">
            <Package className="h-5 w-5" />
          </div>
          <Link to="/" className="font-semibold tracking-tight text-foreground text-lg">
            Procure<span className="font-light text-muted-foreground">Flow</span>
          </Link>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {visibleItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User Status Card */}
        <div className="p-4 border-t border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent text-accent-foreground rounded-full">
              <UserCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground truncate">
                {currentUser?.name}
              </p>
              <p className="text-[10px] text-muted-foreground truncate uppercase flex items-center gap-1 mt-0.5">
                <Shield className="h-2.5 w-2.5" />
                {currentUser?.role}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation (visible on screens < md) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card/95 backdrop-blur border-t border-border flex items-center justify-around px-4 pb-safe z-40 shadow-lg">
        {visibleItems.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`
              }
            >
              <Icon className="h-5 w-5 mb-0.5" />
              <span className="text-[10px] font-medium tracking-tight">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}
