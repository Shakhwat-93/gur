import React, { useState, useEffect } from 'react';
import {
  LayoutGrid,
  Sliders,
  Target,
  Truck,
  Package,
  ClipboardList,
  RotateCw,
  LogOut,
  ArrowLeft,
  Menu,
  X,
  Store,
  ShieldCheck
} from 'lucide-react';
import { useCms } from '../context/CmsContext';
import './admin.css';

export default function AdminLayout({ activeTab, setActiveTab, onNavigateStore, onLogout, children }) {
  const { siteSettings, orders, fetchData, showToast } = useCms();
  const [refreshing, setRefreshing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const pendingCount = orders?.filter((o) => o.status === 'pending')?.length || 0;

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'pixel', label: 'Pixel Setup', icon: Target },
    { id: 'courier', label: 'Fraud & Courier', icon: ShieldCheck },
    { id: 'stock', label: 'Stock', icon: Package },
    { id: 'orders', label: 'Orders', icon: ClipboardList, badge: pendingCount > 0 ? pendingCount : null }
  ];

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (fetchData) await fetchData();
      showToast('Data refreshed successfully');
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  const handleNavClick = (tabId) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="easy-admin-root">
      {/* Top Header */}
      <header className="easy-admin-header">
        <div className="easy-header-container">
          <div className="easy-header-left">
            <button
              type="button"
              className="easy-back-link"
              onClick={onNavigateStore}
              title="Return to public storefront"
            >
              <ArrowLeft size={15} />
              <span>View Store</span>
            </button>
            <h1 className="easy-admin-title">
              {siteSettings?.store_name || 'ম্যাংগো গার্ডেন'} Admin
            </h1>
          </div>

          <div className="easy-header-right">
            {/* Mobile / Tablet Menu Button (visible on <= 1023px) */}
            <button
              type="button"
              className="easy-mobile-menu-btn"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              title="Open Navigation Menu"
            >
              <Menu size={20} />
              <span className="easy-menu-text">Menu</span>
            </button>

            {/* Refresh Button */}
            <button
              type="button"
              className="easy-refresh-btn"
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refresh store and order data"
            >
              <RotateCw size={15} className={refreshing ? 'easy-spinning' : ''} />
              <span className="easy-btn-text">Refresh</span>
            </button>

            {/* Logout / Exit Button */}
            <button
              type="button"
              className="easy-logout-btn"
              onClick={onLogout || onNavigateStore}
              title="Exit admin and logout"
            >
              <LogOut size={15} />
              <span className="easy-btn-text">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="easy-main-container">
        {/* Mobile / Tablet Drawer Backdrop */}
        {mobileMenuOpen && (
          <div
            className="easy-drawer-backdrop"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Floating Sidebar (Desktop) / Slide-over Drawer (Tablet & Mobile) */}
        <aside
          className={`easy-sidebar-card ${mobileMenuOpen ? 'mobile-open' : ''}`}
          aria-label="Admin Navigation"
        >
          {/* Drawer Header (Mobile/Tablet Only) */}
          <div className="easy-drawer-header">
            <div className="easy-drawer-brand">
              <Store size={18} color="#ea580c" />
              <span>{siteSettings?.store_name || 'ম্যাংগো গার্ডেন'} Admin</span>
            </div>
            <button
              type="button"
              className="easy-drawer-close"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="easy-nav-list">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`easy-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleNavClick(item.id)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="easy-nav-badge">{item.badge}</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Drawer Footer with Store Link */}
          <div className="easy-drawer-footer">
            <button
              type="button"
              className="easy-drawer-store-btn"
              onClick={onNavigateStore}
            >
              <ArrowLeft size={14} />
              <span>View Store</span>
            </button>
          </div>
        </aside>

        {/* Dynamic Page Content */}
        <main className="easy-content-area">
          {children}
        </main>
      </div>
    </div>
  );
}
