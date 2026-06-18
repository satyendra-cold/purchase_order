import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/hooks/useAuth';
import { ProtectedRoute } from '@/components/shared/ProtectedRoute';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { GeneratePOPage } from '@/pages/GeneratePOPage';
import { CreateBillPage } from '@/pages/CreateBillPage';
import { ReadyProductPage } from '@/pages/ReadyProductPage';
import { CheckTransportPage } from '@/pages/CheckTransportPage';
import { PrintInvoicePage } from '@/pages/PrintInvoicePage';
import { SupplyCheckPage } from '@/pages/SupplyCheckPage';
import { ApproveProductPage } from '@/pages/ApproveProductPage';
import { PaymentProcessingPage } from '@/pages/PaymentProcessingPage';
import { ToastProvider } from '@/hooks/useToast';

// Layout wrapper component that builds the Sidebar + Header + Footer scaffolding
function AppLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Left Sidebar */}
      <Sidebar mobileOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />
      
      {/* Right Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <Header onToggleSidebar={() => setMobileSidebarOpen(prev => !prev)} />
        
        {/* Scrollable Page Outlet */}
        <main className="flex-grow overflow-y-auto bg-neutral-50/20 dark:bg-neutral-950/5 flex flex-col justify-between min-h-0">
          <div className="max-w-7xl mx-auto w-full px-4 py-6 md:px-8 md:py-8 flex-grow">
            <Outlet />
          </div>
          <Footer />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public Login Route */}
            <Route path="/login" element={<LoginPage />} />
            
            {/* Protected Application Routes */}
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              {/* Index Redirect to Dashboard */}
              <Route 
                index 
                element={<Navigate to="/dashboard" replace />} 
              />

              {/* Dashboard Route */}
              <Route 
                path="dashboard" 
                element={
                  <ProtectedRoute requiredPermission="Dashboard">
                    <DashboardPage />
                  </ProtectedRoute>
                } 
              />
              
              {/* Settings Route */}
              <Route 
                path="settings" 
                element={
                  <ProtectedRoute requiredPermission="Settings">
                    <SettingsPage />
                  </ProtectedRoute>
                } 
              />
              
              {/* Generate PO Route */}
              <Route 
                path="generate-po" 
                element={
                  <ProtectedRoute requiredPermission="Generate PO">
                    <GeneratePOPage />
                  </ProtectedRoute>
                } 
              />
              
              {/* Create Bill Route */}
              <Route 
                path="create-bill" 
                element={
                  <ProtectedRoute requiredPermission="Create Bill">
                    <CreateBillPage />
                  </ProtectedRoute>
                } 
              />
              
              {/* Ready Product Route */}
              <Route 
                path="ready-product" 
                element={
                  <ProtectedRoute requiredPermission="Ready Product">
                    <ReadyProductPage />
                  </ProtectedRoute>
                } 
              />
              
              {/* Check Transport Route */}
              <Route 
                path="check-transport" 
                element={
                  <ProtectedRoute requiredPermission="Check Transport">
                    <CheckTransportPage />
                  </ProtectedRoute>
                } 
              />
              
              {/* Print Invoice Route */}
              <Route 
                path="print-invoice" 
                element={
                  <ProtectedRoute requiredPermission="Print Invoice">
                    <PrintInvoicePage />
                  </ProtectedRoute>
                } 
              />
              
              {/* Supply Check Route */}
              <Route 
                path="supply-check" 
                element={
                  <ProtectedRoute requiredPermission="Supply Check">
                    <SupplyCheckPage />
                  </ProtectedRoute>
                } 
              />
              
              {/* Approve Product Route */}
              <Route 
                path="approve-product" 
                element={
                  <ProtectedRoute requiredPermission="Approve Product">
                    <ApproveProductPage />
                  </ProtectedRoute>
                } 
              />
              
              {/* Payment Processing Route */}
              <Route 
                path="payment-processing" 
                element={
                  <ProtectedRoute requiredPermission="Payment Processing">
                    <PaymentProcessingPage />
                  </ProtectedRoute>
                } 
              />
            </Route>

            {/* Catch-all fallback redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ToastProvider>
  );
}
