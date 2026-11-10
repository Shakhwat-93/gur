import React, { useState, useEffect } from 'react';
import AdminLayout from './AdminLayout';
import AdminLogin from './components/AdminLogin';
import { isAuthenticated, logout } from './authService';
import EasyOverview from './pages/EasyOverview';
import EasyPixelSetup from './pages/EasyPixelSetup';
import EasyCourierSetup from './pages/EasyCourierSetup';
import EasyStock from './pages/EasyStock';
import OrdersManager from './pages/OrdersManager';

export default function AdminApp({ onNavigateStore }) {
  const [isAuthed, setIsAuthed] = useState(() => isAuthenticated());
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    // Re-verify session validity
    setIsAuthed(isAuthenticated());
  }, []);

  const handleLogout = () => {
    logout();
    setIsAuthed(false);
  };

  // If not authenticated, render secure luxury AdminLogin portal
  if (!isAuthed) {
    return (
      <AdminLogin
        onLoginSuccess={() => setIsAuthed(true)}
        onNavigateStore={onNavigateStore}
      />
    );
  }

  // If authenticated, render full Admin dashboard
  return (
    <AdminLayout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onNavigateStore={onNavigateStore}
      onLogout={handleLogout}
    >
      {activeTab === 'overview' && (
        <EasyOverview setActiveTab={setActiveTab} />
      )}

      {activeTab === 'pixel' && (
        <EasyPixelSetup />
      )}

      {activeTab === 'courier' && (
        <EasyCourierSetup />
      )}

      {activeTab === 'stock' && (
        <EasyStock />
      )}

      {activeTab === 'orders' && (
        <OrdersManager />
      )}
    </AdminLayout>
  );
}
