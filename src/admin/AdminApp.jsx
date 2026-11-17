import React, { useState, useEffect, useCallback } from 'react';
import AdminLayout from './AdminLayout';
import AdminLogin from './components/AdminLogin';
import { isAuthenticated, logout } from './authService';
import EasyOverview from './pages/EasyOverview';
import EasyPixelSetup from './pages/EasyPixelSetup';
import EasyCourierSetup from './pages/EasyCourierSetup';
import EasyStock from './pages/EasyStock';
import OrdersManager from './pages/OrdersManager';
import CourierManagement from './pages/CourierManagement';

function resolveTabFromPath() {
  if (typeof window === 'undefined') return 'overview';
  const p = window.location.pathname.toLowerCase().replace(/\/+$/, '');
  if (p === '/admin/courier') return 'courier_management';
  if (p === '/admin/settings/courier' || p === '/admin/courier-settings') return 'courier';
  if (p === '/admin/orders') return 'orders';
  if (p === '/admin/stock') return 'stock';
  if (p === '/admin/pixel') return 'pixel';
  return 'overview';
}

const TAB_TO_PATH = {
  overview: '/admin',
  orders: '/admin/orders',
  courier_management: '/admin/courier',
  courier: '/admin/settings/courier',
  stock: '/admin/stock',
  pixel: '/admin/pixel'
};

export default function AdminApp({ onNavigateStore }) {
  const [isAuthed, setIsAuthed] = useState(() => isAuthenticated());
  const [activeTab, setActiveTabState] = useState(() => resolveTabFromPath());
  const [focusOrderId, setFocusOrderId] = useState(null);

  useEffect(() => {
    setIsAuthed(isAuthenticated());
    const onPopState = () => {
      setActiveTabState(resolveTabFromPath());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const setActiveTab = useCallback((nextTab) => {
    setActiveTabState(nextTab);
    if (nextTab !== 'orders') setFocusOrderId(null);
    const targetPath = TAB_TO_PATH[nextTab] || '/admin';
    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  }, []);

  const handleViewOriginalOrder = useCallback((orderId) => {
    setFocusOrderId(String(orderId));
    setActiveTabState('orders');
    if (typeof window !== 'undefined' && window.location.pathname !== '/admin/orders') {
      window.history.pushState({}, '', '/admin/orders');
    }
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

      {activeTab === 'orders' && (
        <OrdersManager
          focusOrderId={focusOrderId}
          onClearFocusOrder={() => setFocusOrderId(null)}
          onOpenCourierDashboard={() => setActiveTab('courier_management')}
        />
      )}

      {activeTab === 'courier_management' && (
        <CourierManagement
          onNavigateTab={setActiveTab}
          onViewOriginalOrder={handleViewOriginalOrder}
        />
      )}

      {activeTab === 'courier' && (
        <EasyCourierSetup
          onOpenCourierDashboard={() => setActiveTab('courier_management')}
        />
      )}

      {activeTab === 'stock' && (
        <EasyStock />
      )}

      {activeTab === 'pixel' && (
        <EasyPixelSetup />
      )}
    </AdminLayout>
  );
}
