import React, { useState } from 'react';
import { Eye, EyeOff, ArrowRight, Package, Clock, ShoppingBag, DollarSign, Copy, Check, Lock } from 'lucide-react';
import { useCms } from '../../context/CmsContext';
import PinModal from '../components/PinModal';
import { formatOrderCourierText } from '../../lib/orderHelper';

export default function EasyOverview({ setActiveTab }) {
  const { orders, products, showToast } = useCms();
  const [isRevenueRevealed, setIsRevenueRevealed] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [copiedOrderId, setCopiedOrderId] = useState(null);

  const copyOrderDetails = (ord) => {
    if (!ord) return;

    const formattedText = formatOrderCourierText(ord);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(formattedText);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = formattedText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }

    setCopiedOrderId(ord.order_id || ord.id);
    if (showToast) {
      showToast('Order details copied to clipboard');
    }
    setTimeout(() => {
      setCopiedOrderId(null);
    }, 2500);
  };

  const totalOrdersCount = orders?.length || 0;
  const pendingOrdersCount = orders?.filter((o) => o.status === 'pending')?.length || 0;
  const activePackagesCount = products?.length || 0;

  // Real total revenue calculation (excluding cancelled orders)
  const totalRevenue = orders?.reduce((acc, o) => {
    if (o.status === 'cancelled') return acc;
    const raw = o.total_price !== undefined ? o.total_price : o.total;
    const val = typeof raw === 'number' ? raw : parseFloat(raw) || 0;
    return acc + (isNaN(val) ? 0 : val);
  }, 0) || 0;

  const handleRevenueToggle = () => {
    if (isRevenueRevealed) {
      // Re-blur immediately
      setIsRevenueRevealed(false);
    } else {
      // Require PIN to unlock
      setIsPinModalOpen(true);
    }
  };

  const handlePinSuccess = () => {
    setIsRevenueRevealed(true);
    setIsPinModalOpen(false);
    if (showToast) {
      showToast('Revenue unlocked');
    }
  };

  return (
    <div className="easy-overview-space">
      {/* 4 Metric Cards Row */}
      <div className="easy-metrics-grid">
        {/* Metric 1: Total Orders */}
        <div className="easy-metric-card">
          <div className="easy-metric-label">Total Orders</div>
          <div className="easy-metric-val">{totalOrdersCount.toLocaleString('en-US')}</div>
        </div>

        {/* Metric 2: Pending Orders */}
        <div className="easy-metric-card">
          <div className="easy-metric-label">Pending Orders</div>
          <div className="easy-metric-val">{pendingOrdersCount}</div>
        </div>

        {/* Metric 3: Active Packages */}
        <div className="easy-metric-card">
          <div className="easy-metric-label">Active Packages</div>
          <div className="easy-metric-val">{activePackagesCount}</div>
        </div>

        {/* Metric 4: Revenue (Permanently Blurred by default, PIN required to reveal) */}
        <div className="easy-metric-card">
          <div className="easy-metric-head">
            <span className="easy-metric-label">Revenue</span>
            <button
              type="button"
              className="easy-eye-btn"
              onClick={handleRevenueToggle}
              title={isRevenueRevealed ? 'Hide revenue' : 'Enter PIN to reveal'}
              style={{
                background: isRevenueRevealed ? '#ecfdf5' : '#f1f5f9',
                color: isRevenueRevealed ? '#059669' : '#64748b'
              }}
            >
              {isRevenueRevealed ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <div
            className="easy-blurred-container"
            onClick={() => {
              if (!isRevenueRevealed) setIsPinModalOpen(true);
            }}
          >
            <div className={`easy-metric-val ${!isRevenueRevealed ? 'easy-blurred' : ''}`}>
              ৳ {totalRevenue.toLocaleString('en-US')}
            </div>

            {!isRevenueRevealed && (
              <span className="easy-blurred-pill">
                <Lock size={11} />
                <span>PIN Protected</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Recent Orders Overview */}
      <div className="easy-subcard" style={{ marginTop: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: '#111827' }}>
              Recent Orders
            </h3>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: '2px 0 0 0' }}>
              Latest customer purchases and order requests
            </p>
          </div>
          <button
            type="button"
            className="easy-pill-link"
            onClick={() => setActiveTab('orders')}
          >
            View All Orders →
          </button>
        </div>

        {orders && orders.length > 0 ? (
          <div className="easy-table-wrap">
            <table className="easy-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 5).map((o) => (
                  <tr key={o.id || o.order_id}>
                    <td style={{ fontWeight: 600 }}>#{o.order_id || o.id}</td>
                    <td>{o.name}</td>
                    <td>{o.phone}</td>
                    <td style={{ maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {o.address}
                    </td>
                    <td style={{ fontWeight: 700, color: '#ea580c' }}>
                      ৳ {o.total_price || o.total || 0}
                    </td>
                    <td>
                      <span className={`easy-status-tag ${o.status || 'pending'}`}>
                        {o.status === 'pending'
                          ? 'Pending'
                          : o.status === 'confirmed'
                          ? 'Confirmed'
                          : o.status === 'shipped'
                          ? 'Shipped'
                          : o.status === 'delivered'
                          ? 'Delivered'
                          : o.status === 'cancelled'
                          ? 'Cancelled'
                          : o.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="adm-btn adm-btn-sm"
                        style={{
                          background: copiedOrderId === (o.order_id || o.id) ? '#ecfdf5' : '#fff7ed',
                          color: copiedOrderId === (o.order_id || o.id) ? '#059669' : '#ea580c',
                          borderColor: copiedOrderId === (o.order_id || o.id) ? '#a7f3d0' : '#fed7aa',
                          fontWeight: 600,
                          padding: '4px 8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                        onClick={() => copyOrderDetails(o)}
                        title="Copy order details"
                      >
                        {copiedOrderId === (o.order_id || o.id) ? <Check size={12} color="#059669" /> : <Copy size={12} />}
                        <span>{copiedOrderId === (o.order_id || o.id) ? 'Copied' : 'Copy'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: '#6b7280' }}>
            <p style={{ margin: 0, fontSize: '14px' }}>No orders found yet.</p>
          </div>
        )}
      </div>

      {/* Security PIN Modal */}
      <PinModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccess={handlePinSuccess}
      />
    </div>
  );
}
