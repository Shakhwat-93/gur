import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Eye,
  Trash2,
  Phone,
  MapPin,
  Calendar,
  CheckCircle,
  Clock,
  Truck,
  XCircle,
  FileText,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  RotateCw,
  Package,
  ChevronRight,
  ExternalLink,
  Printer,
  CheckSquare,
  Plus,
  Send
} from 'lucide-react';
import { useCms } from '../../context/CmsContext';
import { normalizeBdPhone } from '../../lib/phoneNormalizer';
import { getEffectiveOrderQty, formatOrderCourierText } from '../../lib/orderHelper';
import CourierStatsCard from '../../components/CourierStatsCard';
import ThermalPrintModal from '../components/ThermalPrintModal';
import CreateOrderModal from '../components/CreateOrderModal';
import { isOrderPrinted } from '../lib/thermalPrintStorage';
import {
  fetchEShipFirstParcels,
  createEShipFirstParcel,
  refreshEShipFirstParcelStatus,
  fetchEShipFirstFraudScore,
  getDeliveryStatusInfo,
  getReturnStatusInfo
} from '../lib/eshipfirstClient';

export default function OrdersManager({ focusOrderId = null, onClearFocusOrder = null, onOpenCourierDashboard = null }) {
  const { orders, updateOrderStatus, deleteOrder, showToast, siteSettings } = useCms();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusTab, setStatusTab] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [copiedOrderId, setCopiedOrderId] = useState(null);

  // Checkbox selection & Thermal Print states
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [ordersToPrint, setOrdersToPrint] = useState([]);
  const [printedVersion, setPrintedVersion] = useState(0);

  // Manual Order Creation Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // BD Courier checks map by normalized phone
  const [courierChecks, setCourierChecks] = useState({});
  const [checkingPhone, setCheckingPhone] = useState(null);

  // eShipFirst Courier Integration State
  const [eshipParcelsMap, setEshipParcelsMap] = useState({});
  const [eshipConfig, setEshipConfig] = useState(null);
  const [submittingCourierOrderId, setSubmittingCourierOrderId] = useState(null);
  const [syncingCourierOrderId, setSyncingCourierOrderId] = useState(null);
  const [eshipFraudScore, setEshipFraudScore] = useState(null);
  const [eshipFraudLoading, setEshipFraudLoading] = useState(false);

  const loadEShipFirstData = async () => {
    try {
      const { ok, data } = await fetchEShipFirstParcels();
      if (ok && data?.success) {
        const map = {};
        (data.parcels || []).forEach((p) => {
          if (p?.order_id) map[String(p.order_id)] = p;
        });
        setEshipParcelsMap(map);
        if (data.config) setEshipConfig(data.config);
      }
    } catch (err) {
      console.warn('Could not load eShipFirst parcels:', err);
    }
  };

  // Enrich an order with synchronized eShipFirst courier metadata (never overwrites internal order_id)
  const enrichOrder = (ord) => {
    if (!ord) return ord;
    const key = String(ord.order_id || ord.id);
    const parcel = eshipParcelsMap[key];
    if (!parcel) return ord;
    return {
      ...ord,
      courier_provider: parcel.courier_provider || ord.courier_provider || 'eshipfirst',
      consignment_id: parcel.consignment_id || ord.consignment_id || '',
      tracking_code: parcel.tracking_code || ord.tracking_code || '',
      courier_booking_status: parcel.courier_booking_status || ord.courier_booking_status || '',
      courier_delivery_status: parcel.courier_delivery_status || ord.courier_delivery_status || '',
      courier_return_status: parcel.courier_return_status || ord.courier_return_status || '',
      courier_submitted_at: parcel.courier_submitted_at || ord.courier_submitted_at || null,
      last_status_checked_at: parcel.last_status_checked_at || ord.last_status_checked_at || null,
      courier_last_error: parcel.last_error || ''
    };
  };

  // Fetch all existing courier checks from backend
  const loadCourierChecks = async () => {
    try {
      const res = await fetch('/api/courier-check');
      const json = await res.json();
      if (json?.checks && Array.isArray(json.checks)) {
        const map = {};
        json.checks.forEach((c) => {
          if (c.phone) {
            const canonical = normalizeBdPhone(c.phone);
            map[canonical] = c;
          }
        });
        setCourierChecks(map);
      }
    } catch (err) {
      console.warn('Could not load courier checks list:', err);
    }
  };

  useEffect(() => {
    loadCourierChecks();
    loadEShipFirstData();
  }, [orders]);

  // Open specific order when navigated via "View Original Order" from /admin/courier
  useEffect(() => {
    if (focusOrderId && orders.length > 0) {
      const target = orders.find(
        (o) => String(o.order_id || o.id) === String(focusOrderId)
      );
      if (target) {
        setSelectedOrder(target);
        onClearFocusOrder?.();
      }
    }
  }, [focusOrderId, orders]);

  // Auto-load courier intelligence if not cached yet when an order modal opens
  useEffect(() => {
    setEshipFraudScore(null);
    if (selectedOrder && selectedOrder.phone) {
      const canonical = normalizeBdPhone(selectedOrder.phone);
      if (!courierChecks[canonical] && checkingPhone !== selectedOrder.phone) {
        handleTriggerCourierCheck(selectedOrder);
      }
    }
  }, [selectedOrder]);

  // Submit / retry parcel booking with eShipFirst
  const handleSendToEShipFirst = async (ord, forceRetry = false) => {
    if (!ord) return null;
    const key = String(ord.order_id || ord.id);
    setSubmittingCourierOrderId(key);
    try {
      const { ok, data } = await createEShipFirstParcel(key, ord, forceRetry);
      if (ok && data?.success) {
        if (data.parcel) {
          setEshipParcelsMap((prev) => ({ ...prev, [key]: data.parcel }));
        }
        showToast?.(data.message || `eShipFirst Parcel Created! CID: #${data.parcel?.consignment_id || ''}`);
        await loadEShipFirstData();
        return data.parcel || null;
      }
      if (!data?.skipped) {
        showToast?.(data?.error || 'Failed to submit parcel to eShipFirst', 'error');
        await loadEShipFirstData();
      }
      return null;
    } catch (err) {
      showToast?.(err.message || 'Network error submitting to eShipFirst', 'error');
      return null;
    } finally {
      setSubmittingCourierOrderId(null);
    }
  };

  // Refresh delivery status from eShipFirst for an order
  const handleRefreshEShipFirstStatus = async (ord) => {
    const enriched = enrichOrder(ord);
    const key = String(enriched.order_id || enriched.id);
    setSyncingCourierOrderId(key);
    try {
      const { ok, data } = await refreshEShipFirstParcelStatus({
        orderId: key,
        consignmentId: enriched.consignment_id,
        trackingCode: enriched.tracking_code,
        invoice: key
      });
      if (ok && data?.success) {
        if (data.parcel) {
          setEshipParcelsMap((prev) => ({ ...prev, [key]: data.parcel }));
        }
        showToast?.(data.cached ? data.message : `Status synced: ${data.delivery_status || 'Updated'}`);
      } else {
        showToast?.(data?.error || 'Status sync failed', 'error');
      }
    } catch (err) {
      showToast?.(err.message || 'Status sync error', 'error');
    } finally {
      setSyncingCourierOrderId(null);
    }
  };

  // Check eShipFirst Fraud Score for customer phone inside Order Details
  const handleCheckEShipFirstFraud = async (phone) => {
    if (!phone) return;
    setEshipFraudLoading(true);
    try {
      const { ok, data } = await fetchEShipFirstFraudScore(phone);
      setEshipFraudScore(data);
      if (!ok || !data?.success) {
        showToast?.(data?.error || 'eShipFirst fraud score unavailable', 'error');
      }
    } catch (err) {
      setEshipFraudScore({ success: false, error: err.message });
    } finally {
      setEshipFraudLoading(false);
    }
  };

  // Unified status change handler: automatically submits to eShipFirst on order confirmation
  const handleOrderStatusChange = async (ord, newStatus) => {
    const key = String(ord.order_id || ord.id);
    const updated = await updateOrderStatus(ord.order_id || ord.id, newStatus);
    if (selectedOrder && String(selectedOrder.order_id || selectedOrder.id) === key) {
      setSelectedOrder((prev) => (prev ? { ...prev, status: newStatus } : prev));
    }

    // Automatic Order Submission when confirming an unbooked order
    if (updated && newStatus === 'confirmed') {
      const enriched = enrichOrder(ord);
      const alreadyHasCid = Boolean(enriched.consignment_id);
      if (!alreadyHasCid && eshipConfig?.is_enabled && eshipConfig?.auto_submit_on_confirm) {
        await handleSendToEShipFirst({ ...ord, status: 'confirmed' }, false);
      }
    }
  };

  // Trigger manual courier check for an order
  const handleTriggerCourierCheck = async (ord) => {
    if (!ord?.phone) return;
    const phone = ord.phone;
    setCheckingPhone(phone);
    try {
      const res = await fetch('/api/courier-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: ord.phone,
          orderId: ord.order_id
        })
      });
      const data = await res.json();
      if (data.status === 'completed') {
        showToast('Courier history loaded successfully');
      } else if (data.status === 'disabled') {
        showToast('BD Courier integration is disabled in settings', 'error');
      } else {
        showToast(data.error || 'Courier check failed', 'error');
      }
      await loadCourierChecks();
    } catch (err) {
      showToast('Error requesting courier data', 'error');
    } finally {
      setCheckingPhone(null);
    }
  };

  // Clean 4-line courier copy
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

  const filteredOrders = orders.filter((o) => {
    const enriched = enrichOrder(o);
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      (enriched.order_id && enriched.order_id.toLowerCase().includes(q)) ||
      (enriched.consignment_id && String(enriched.consignment_id).toLowerCase().includes(q)) ||
      (enriched.tracking_code && String(enriched.tracking_code).toLowerCase().includes(q)) ||
      (enriched.name && enriched.name.toLowerCase().includes(q)) ||
      (enriched.phone && enriched.phone.includes(q)) ||
      (enriched.address && enriched.address.toLowerCase().includes(q));

    const matchesStatus = statusTab === 'all' ? true : enriched.status === statusTab;
    return matchesSearch && matchesStatus;
  });

  // Checkbox selection & bulk print handlers
  const toggleSelectOrder = (id) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      const strId = String(id);
      if (next.has(strId)) next.delete(strId);
      else next.add(strId);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (filteredOrders.length > 0 && selectedOrderIds.size === filteredOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(filteredOrders.map((o) => String(o.order_id || o.id))));
    }
  };

  const handleClearSelection = () => {
    setSelectedOrderIds(new Set());
  };

  const handlePrintSingle = (ord) => {
    if (!ord) return;
    setOrdersToPrint([enrichOrder(ord)]);
    setPrintModalOpen(true);
  };

  const handleOrderCreated = (newOrder) => {
    if (newOrder?.phone) {
      handleTriggerCourierCheck(newOrder);
    }
  };

  const handleOpenPrintFromCreate = (newOrder) => {
    handlePrintSingle(newOrder);
  };

  const handleBulkPrint = () => {
    const list = filteredOrders
      .filter((o) => selectedOrderIds.has(String(o.order_id || o.id)))
      .map(enrichOrder);
    if (list.length === 0) {
      if (showToast) showToast('Please select at least one order to print', 'error');
      return;
    }
    setOrdersToPrint(list);
    setPrintModalOpen(true);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="adm-badge adm-badge-warning">Pending</span>;
      case 'confirmed':
        return <span className="adm-badge adm-badge-info">Confirmed</span>;
      case 'processing':
        return <span className="adm-badge adm-badge-info">Processing</span>;
      case 'shipped':
        return <span className="adm-badge adm-badge-info">Shipped</span>;
      case 'delivered':
        return <span className="adm-badge adm-badge-success">Delivered</span>;
      case 'cancelled':
        return <span className="adm-badge adm-badge-danger">Cancelled</span>;
      default:
        return <span className="adm-badge">{status}</span>;
    }
  };

  // Render Courier Ratio pill for table row / mobile card
  const renderCourierBadge = (ord, isMobile = false) => {
    const norm = normalizeBdPhone(ord.phone);
    const check = courierChecks[norm];

    if (!check) {
      return (
        <button
          type="button"
          className="adm-btn adm-btn-sm adm-courier-probe-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleTriggerCourierCheck(ord);
          }}
          disabled={checkingPhone === ord.phone}
          title="Check customer delivery history via BD Courier API"
        >
          {checkingPhone === ord.phone ? (
            <RotateCw size={12} className="easy-spinning" />
          ) : (
            <ShieldCheck size={12} />
          )}
          <span>{checkingPhone === ord.phone ? 'Checking...' : 'Check Courier'}</span>
        </button>
      );
    }

    if (check.status === 'completed' && check.data) {
      const summary = check.data.summary || {};
      const total = Number(summary.total_parcel || 0);
      const success = Number(summary.success_parcel || 0);
      const ratio = Number(summary.success_ratio || 0);

      if (total === 0) {
        return (
          <span
            className="adm-badge"
            style={{
              background: '#f1f5f9',
              color: '#475569',
              fontSize: '11.5px',
              whiteSpace: 'nowrap',
              border: '1px solid #cbd5e1'
            }}
            title="New Customer (No courier history)"
          >
            New (0)
          </span>
        );
      }

      const isHigh = ratio >= 80;
      const isMed = ratio >= 60 && ratio < 80;
      const bg = isHigh ? '#ecfdf5' : isMed ? '#fffbeb' : '#fff1f2';
      const col = isHigh ? '#059669' : isMed ? '#d97706' : '#e11d48';

      return (
        <span
          className="adm-badge"
          style={{
            background: bg,
            color: col,
            borderColor: col,
            borderWidth: '1px',
            borderStyle: 'solid',
            fontWeight: 700,
            fontSize: '11.5px',
            whiteSpace: 'nowrap'
          }}
          title={`Total: ${total}, Delivered: ${success}, Cancelled: ${summary.cancelled_parcel || 0}`}
        >
          {ratio}% ({success}/{total})
        </span>
      );
    }

    if (check.status === 'failed' || check.status === 'unknown') {
      return (
        <span
          className="adm-badge adm-badge-danger"
          style={{ fontSize: '11px', whiteSpace: 'nowrap' }}
          title={check.error || 'Check failed'}
        >
          Failed
        </span>
      );
    }

    if (check.status === 'pending') {
      return (
        <span
          className="adm-badge adm-badge-warning"
          style={{ fontSize: '11px', whiteSpace: 'nowrap' }}
        >
          Checking...
        </span>
      );
    }

    return null;
  };

  // Find all orders that reuse the same phone number as selectedOrder
  const samePhoneOrders = selectedOrder
    ? orders.filter(
        (o) => normalizeBdPhone(o.phone) === normalizeBdPhone(selectedOrder.phone)
      )
    : [];

  const selectedCheck = selectedOrder
    ? courierChecks[normalizeBdPhone(selectedOrder.phone)]
    : null;

  return (
    <div className="adm-orders-page-shell">
      {/* Top Header */}
      <div className="adm-page-header-wrap">
        <div>
          <h2 className="adm-page-main-heading">
            Orders Management <span className="adm-count-pill">({orders.length})</span>
          </h2>
          <p className="adm-page-sub-heading">
            Track customer orders, delivery status, and courier verification.
          </p>
        </div>

        <button
          type="button"
          className="adm-btn adm-btn-primary"
          onClick={() => setIsCreateModalOpen(true)}
          style={{
            background: '#008060',
            borderColor: '#008060',
            color: '#ffffff',
            padding: '9px 18px',
            fontSize: '13.5px',
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 2px 8px rgba(0, 128, 96, 0.25)',
            cursor: 'pointer'
          }}
        >
          <Plus size={16} />
          <span>+ Create Order (নতুন অর্ডার)</span>
        </button>
      </div>

      {/* Filter Tabs & Search Card */}
      <div className="adm-card adm-filter-card">
        <div className="adm-card-body" style={{ padding: '12px 16px' }}>
          {/* Scrollable Filter Tabs */}
          <div className="adm-filter-tabs-scroll">
            {[
              { id: 'all', label: `All (${orders.length})` },
              { id: 'pending', label: `Pending (${orders.filter((o) => o.status === 'pending').length})` },
              { id: 'confirmed', label: `Confirmed (${orders.filter((o) => o.status === 'confirmed').length})` },
              { id: 'shipped', label: `Shipped (${orders.filter((o) => o.status === 'shipped').length})` },
              { id: 'delivered', label: `Delivered (${orders.filter((o) => o.status === 'delivered').length})` },
              { id: 'cancelled', label: `Cancelled (${orders.filter((o) => o.status === 'cancelled').length})` }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`adm-filter-tab-btn ${statusTab === tab.id ? 'active' : ''}`}
                onClick={() => setStatusTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Field */}
          <div className="adm-search-input-wrap">
            <Search size={16} className="adm-search-icon" />
            <input
              type="text"
              placeholder="Search by order ID, customer name, phone, or address..."
              className="adm-input adm-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Orders Container: Desktop Table (>= 768px) & Mobile Order Cards (< 768px) */}
      <div className="adm-card adm-orders-content-card">
        {filteredOrders.length === 0 ? (
          <div className="adm-empty-state-box">
            <p>No orders found matching your criteria.</p>
          </div>
        ) : (
          <>
            {/* ============================================================ */}
            {/* 1. DESKTOP & LAPTOP TABLE (>= 768px)                          */}
            {/* ============================================================ */}
            <div className="adm-table-wrap adm-desktop-table">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th className="th-checkbox">
                      <input
                        type="checkbox"
                        className="adm-checkbox"
                        checked={filteredOrders.length > 0 && selectedOrderIds.size === filteredOrders.length}
                        onChange={handleSelectAll}
                        title={selectedOrderIds.size === filteredOrders.length ? 'Deselect All' : 'Select All'}
                        aria-label="Select all orders"
                      />
                    </th>
                    <th className="th-order-id">Order ID</th>
                    <th className="th-date">Date</th>
                    <th className="th-customer">Customer</th>
                    <th className="th-courier">Courier Score</th>
                    <th className="th-product">Product / Qty</th>
                    <th className="th-total">Total</th>
                    <th className="th-status">Status</th>
                    <th className="th-actions" style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((rawOrd) => {
                    const ord = enrichOrder(rawOrd);
                    const isSelected = selectedOrderIds.has(String(ord.order_id || ord.id));
                    const isPrinted = isOrderPrinted(ord.order_id || ord.id);

                    return (
                      <tr key={ord.order_id || ord.id} className={isSelected ? 'adm-row-selected' : ''}>
                        {/* Checkbox */}
                        <td className="td-checkbox">
                          <input
                            type="checkbox"
                            className="adm-checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOrder(ord.order_id || ord.id)}
                            aria-label={`Select order ${ord.order_id}`}
                          />
                        </td>

                        {/* Order ID, eShipFirst Consignment ID & Printed Indicator */}
                        <td className="td-order-id">
                          <span className="adm-id-text">{ord.order_id}</span>
                          {ord.consignment_id && (
                            <div style={{ marginTop: '3px' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  fontFamily: 'monospace',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  background: '#e0f2fe',
                                  color: '#0369a1',
                                  border: '1px solid #bae6fd',
                                  padding: '1px 6px',
                                  borderRadius: '4px'
                                }}
                                title={`eShipFirst Consignment ID${ord.tracking_code ? ` · Tracking: ${ord.tracking_code}` : ''}`}
                              >
                                CID #{ord.consignment_id}
                              </span>
                            </div>
                          )}
                          {isPrinted && (
                            <div style={{ marginTop: '3px' }}>
                              <span className="adm-printed-pill" title="Sticker already printed">
                                ✓ Printed
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Date */}
                        <td className="td-date">
                          {ord.created_at
                            ? new Date(ord.created_at).toLocaleDateString('bn-BD', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })
                            : 'N/A'}
                        </td>

                        {/* Customer Info (Natural Multi-line Bengali) */}
                        <td className="td-customer">
                          <div className="adm-cust-name">{ord.name}</div>
                          <div className="adm-cust-phone">
                            <Phone size={12} />
                            <a href={`tel:${ord.phone}`}>{ord.phone}</a>
                          </div>
                          <div className="adm-cust-address" title={`${ord.address}, ${ord.area || ''}`}>
                            {ord.address}{ord.area ? `, ${ord.area}` : ''}
                          </div>
                        </td>

                        {/* Courier Score */}
                        <td className="td-courier">
                          {renderCourierBadge(ord)}
                        </td>

                        {/* Product Package */}
                        <td className="td-product">
                          <div className="adm-pkg-name">{ord.package_name || ord.product_name || 'খাঁটি খেজুরের গুড়'}</div>
                          <div className="adm-pkg-qty">Qty: {getEffectiveOrderQty(ord)}</div>
                        </td>

                        {/* Total COD Amount */}
                        <td className="td-total">
                          <div className="adm-total-amt">৳ {ord.total_price || ord.total || 0}</div>
                          <div className="adm-cod-badge">Cash On Delivery</div>
                        </td>

                        {/* Status Dropdown */}
                        <td className="td-status">
                          <select
                            className={`adm-status-select ${ord.status || 'pending'}`}
                            value={ord.status || 'pending'}
                            onChange={(e) => handleOrderStatusChange(ord, e.target.value)}
                          >
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="processing">Processing</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>

                        {/* Actions: Print Thermal Sticker, Copy, View, Delete */}
                        <td className="td-actions" style={{ textAlign: 'right' }}>
                          <div className="adm-actions-group">
                            <button
                              type="button"
                              className="adm-btn adm-btn-sm adm-btn-print"
                              onClick={() => handlePrintSingle(ord)}
                              title="Print 100mm × 150mm Direct Thermal Sticker"
                            >
                              <Printer size={13} />
                              <span>{isPrinted ? 'Reprint' : 'Print'}</span>
                            </button>

                            <button
                              type="button"
                              className="adm-btn adm-btn-sm adm-btn-copy"
                              onClick={() => copyOrderDetails(ord)}
                              title="Copy order details"
                            >
                              {copiedOrderId === (ord.order_id || ord.id) ? (
                                <Check size={13} color="#059669" />
                              ) : (
                                <Copy size={13} />
                              )}
                              <span>{copiedOrderId === (ord.order_id || ord.id) ? 'Copied' : 'Copy'}</span>
                            </button>

                            <button
                              type="button"
                              className="adm-btn adm-btn-sm"
                              onClick={() => setSelectedOrder(ord)}
                              title="View order details"
                            >
                              <Eye size={13} />
                              <span>View</span>
                            </button>

                            <button
                              type="button"
                              className="adm-btn adm-btn-sm adm-btn-danger"
                              onClick={() => {
                                if (window.confirm('Are you sure you want to delete this order?')) {
                                  deleteOrder(ord.order_id);
                                }
                              }}
                              title="Delete order"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ============================================================ */}
            {/* 2. MOBILE ORDER CARDS (< 768px)                               */}
            {/* ============================================================ */}
            <div className="adm-mobile-cards-list">
              {filteredOrders.map((rawOrd) => {
                const ord = enrichOrder(rawOrd);
                const isSelected = selectedOrderIds.has(String(ord.order_id || ord.id));
                const isPrinted = isOrderPrinted(ord.order_id || ord.id);

                return (
                  <div
                    key={ord.order_id || ord.id}
                    className={`adm-order-card ${isSelected ? 'adm-row-selected' : ''}`}
                  >
                    {/* Card Header: Checkbox + Order ID + Date + Status Select */}
                    <div className="adm-card-top-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input
                          type="checkbox"
                          className="adm-checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOrder(ord.order_id || ord.id)}
                          aria-label={`Select order ${ord.order_id}`}
                        />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <div className="adm-card-order-id">#{ord.order_id}</div>
                            {ord.consignment_id && (
                              <span
                                style={{
                                  fontFamily: 'monospace',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  background: '#e0f2fe',
                                  color: '#0369a1',
                                  border: '1px solid #bae6fd',
                                  padding: '1px 6px',
                                  borderRadius: '4px'
                                }}
                              >
                                CID #{ord.consignment_id}
                              </span>
                            )}
                            {isPrinted && (
                              <span className="adm-printed-pill" title="Sticker already printed">
                                ✓ Printed
                              </span>
                            )}
                          </div>
                          <div className="adm-card-date">
                            {ord.created_at
                              ? new Date(ord.created_at).toLocaleDateString('bn-BD', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                })
                              : 'N/A'}
                          </div>
                        </div>
                      </div>

                      <div className="adm-card-status-col">
                        <select
                          className={`adm-status-select mobile ${ord.status || 'pending'}`}
                          value={ord.status || 'pending'}
                          onChange={(e) => handleOrderStatusChange(ord, e.target.value)}
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="processing">Processing</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </div>

                    {/* Customer Information Block */}
                    <div className="adm-card-customer-block">
                      <div className="adm-card-cust-name">{ord.name}</div>
                      <div className="adm-card-phone-row">
                        <a href={`tel:${ord.phone}`} className="adm-card-phone-link">
                          <Phone size={13} />
                          <span>{ord.phone}</span>
                        </a>
                        <div className="adm-card-courier-wrap">
                          {renderCourierBadge(ord, true)}
                        </div>
                      </div>
                      <div className="adm-card-address">
                        <MapPin size={12} className="adm-pin-icon" />
                        <span>{ord.address}{ord.area ? `, ${ord.area}` : ''}</span>
                      </div>
                    </div>

                    {/* Product & Price Summary Block */}
                    <div className="adm-card-product-summary">
                      <div className="adm-card-pkg-info">
                        <Package size={14} color="#ea580c" />
                        <div className="adm-card-pkg-text">
                          <strong>{ord.package_name || ord.product_name || 'খাঁটি খেজুরের গুড়'}</strong>
                          <span className="adm-card-qty-badge">× {getEffectiveOrderQty(ord)}</span>
                        </div>
                      </div>
                      <div className="adm-card-price-info">
                        <div className="adm-card-price">৳ {ord.total_price || ord.total || 0}</div>
                        <div className="adm-card-cod-tag">Cash On Delivery</div>
                      </div>
                    </div>

                    {/* Card Action Buttons (Print, Copy, View, Delete) */}
                    <div className="adm-card-actions-grid">
                      <button
                        type="button"
                        className="adm-btn adm-card-btn print"
                        onClick={() => handlePrintSingle(ord)}
                        title="Print 100mm × 150mm Direct Thermal Sticker"
                      >
                        <Printer size={15} />
                        <span>{isPrinted ? 'Reprint' : 'Print'}</span>
                      </button>

                      <button
                        type="button"
                        className="adm-btn adm-card-btn copy"
                        onClick={() => copyOrderDetails(ord)}
                        title="Copy order details"
                      >
                        {copiedOrderId === (ord.order_id || ord.id) ? (
                          <Check size={15} color="#059669" />
                        ) : (
                          <Copy size={15} />
                        )}
                        <span>{copiedOrderId === (ord.order_id || ord.id) ? 'Copied' : 'Copy'}</span>
                      </button>

                      <button
                        type="button"
                        className="adm-btn adm-card-btn view"
                        onClick={() => setSelectedOrder(ord)}
                        title="View order details"
                      >
                        <Eye size={15} />
                        <span>View</span>
                      </button>

                      <button
                        type="button"
                        className="adm-btn adm-card-btn delete"
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this order?')) {
                            deleteOrder(ord.order_id);
                          }
                        }}
                        title="Delete order"
                      >
                        <Trash2 size={15} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedOrderIds.size > 0 && (
        <div className="adm-bulk-toolbar" role="region" aria-label="Bulk actions">
          <div className="adm-bulk-toolbar-left">
            <span className="adm-bulk-count-badge">
              {selectedOrderIds.size} {selectedOrderIds.size === 1 ? 'Order' : 'Orders'} Selected
            </span>
            <button
              type="button"
              className="adm-btn adm-btn-sm adm-bulk-select-all-btn"
              onClick={handleSelectAll}
            >
              {selectedOrderIds.size === filteredOrders.length ? 'Deselect All' : `Select All (${filteredOrders.length})`}
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-sm adm-bulk-clear-btn"
              onClick={handleClearSelection}
            >
              Clear
            </button>
          </div>
          <div className="adm-bulk-toolbar-right">
            <button
              type="button"
              className="adm-btn adm-bulk-print-btn"
              onClick={handleBulkPrint}
            >
              <Printer size={16} />
              <span>Bulk Print ({selectedOrderIds.size} Stickers)</span>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. ORDER DETAILS MODAL SHEET (FULLY RESPONSIVE)               */}
      {/* ============================================================ */}
      {selectedOrder && (() => {
        const modalOrder = enrichOrder(selectedOrder);
        const modalKey = String(modalOrder.order_id || modalOrder.id);
        const delInfo = modalOrder.courier_delivery_status
          ? getDeliveryStatusInfo(modalOrder.courier_delivery_status)
          : null;
        const retInfo = getReturnStatusInfo(modalOrder.courier_return_status);

        return (
        <div
          className="adm-backdrop"
          onClick={() => setSelectedOrder(null)}
          aria-modal="true"
          role="dialog"
        >
          <div
            className="adm-modal-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Sticky Header */}
            <div className="adm-modal-header">
              <div className="adm-modal-header-text">
                <h3 className="adm-modal-title">
                  {modalOrder.consignment_id
                    ? `Courier Parcel #${modalOrder.consignment_id}`
                    : `Order Details: #${modalOrder.order_id}`}
                </h3>
                <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {getStatusBadge(modalOrder.status)}
                  {modalOrder.consignment_id && (
                    <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, color: '#475569' }}>
                      Internal Ref: #{modalOrder.order_id}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="adm-modal-close-btn"
                onClick={() => setSelectedOrder(null)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="adm-modal-body">
              {/* Actions Row: Courier Copy & Print Thermal Sticker */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                <button
                  type="button"
                  className="adm-btn adm-modal-copy-btn"
                  style={{ marginBottom: 0 }}
                  onClick={() => copyOrderDetails(modalOrder)}
                >
                  {copiedOrderId === modalKey ? (
                    <Check size={18} />
                  ) : (
                    <Copy size={18} />
                  )}
                  <span>
                    {copiedOrderId === modalKey
                      ? '✓ Copied to Clipboard!'
                      : '📋 Copy Order (Courier)'}
                  </span>
                </button>

                <button
                  type="button"
                  className="adm-btn adm-modal-print-btn"
                  onClick={() => handlePrintSingle(modalOrder)}
                  title="Print Direct Thermal Label"
                >
                  <Printer size={18} />
                  <span>
                    {modalOrder.consignment_id
                      ? '🏷️ Print Courier Label'
                      : isOrderPrinted(modalKey)
                      ? '🔄 Reprint Sticker'
                      : '🏷️ Print Sticker (4×4)'}
                  </span>
                </button>
              </div>

              {/* eShipFirst Courier & Consignment Details Card */}
              <div
                className="adm-modal-info-card"
                style={{
                  border: '1.5px solid #bae6fd',
                  background: 'linear-gradient(180deg, #f0f9ff 0%, #ffffff 100%)',
                  marginBottom: '14px'
                }}
              >
                <div
                  className="adm-modal-info-heading"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', color: '#0c4a6e' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Truck size={15} color="#0284c7" /> eShipFirst Courier Dispatch
                  </span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {modalOrder.consignment_id ? (
                      <>
                        <button
                          type="button"
                          className="adm-btn adm-btn-sm"
                          disabled={syncingCourierOrderId === modalKey}
                          onClick={() => handleRefreshEShipFirstStatus(modalOrder)}
                        >
                          <RotateCw size={13} className={syncingCourierOrderId === modalKey ? 'easy-spinning' : ''} />
                          <span>Refresh Status</span>
                        </button>
                        {onOpenCourierDashboard && (
                          <button type="button" className="adm-btn adm-btn-sm" onClick={onOpenCourierDashboard}>
                            Courier Panel →
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        type="button"
                        className="adm-btn adm-btn-sm"
                        disabled={submittingCourierOrderId === modalKey}
                        onClick={() => handleSendToEShipFirst(modalOrder, modalOrder.courier_booking_status === 'failed')}
                        style={{ background: '#0284c7', color: '#ffffff', borderColor: '#0284c7', fontWeight: 700 }}
                      >
                        <Send size={13} />
                        <span>
                          {submittingCourierOrderId === modalKey
                            ? 'Booking...'
                            : modalOrder.courier_booking_status === 'failed'
                            ? 'Retry eShipFirst Booking'
                            : 'Send to eShipFirst'}
                        </span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="adm-btn adm-btn-sm"
                      disabled={eshipFraudLoading}
                      onClick={() => handleCheckEShipFirstFraud(modalOrder.phone)}
                      title="Check customer history via eShipFirst Fraud Score API"
                    >
                      <ShieldCheck size={13} />
                      <span>{eshipFraudLoading ? 'Checking...' : 'Fraud Score'}</span>
                    </button>
                  </div>
                </div>

                {modalOrder.consignment_id ? (
                  <>
                    <div className="adm-modal-info-row">
                      <span className="lbl">eShipFirst Consignment ID:</span>
                      <span className="val bold" style={{ fontFamily: 'monospace', fontSize: '14px', color: '#0369a1' }}>
                        #{modalOrder.consignment_id}
                      </span>
                    </div>
                    <div className="adm-modal-info-row">
                      <span className="lbl">Tracking Code:</span>
                      <span className="val" style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                        {modalOrder.tracking_code || '—'}
                      </span>
                    </div>
                    <div className="adm-modal-info-row">
                      <span className="lbl">Courier Name:</span>
                      <span className="val">eShipFirst</span>
                    </div>
                    <div className="adm-modal-info-row">
                      <span className="lbl">Courier Booking Status:</span>
                      <span className="val bold" style={{ textTransform: 'capitalize' }}>
                        {modalOrder.courier_booking_status || 'booked'}
                      </span>
                    </div>
                    <div className="adm-modal-info-row">
                      <span className="lbl">Current Delivery Status:</span>
                      <span className="val">
                        {delInfo ? (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              background: delInfo.bg,
                              color: delInfo.color,
                              border: `1px solid ${delInfo.border}`
                            }}
                          >
                            {delInfo.label}
                          </span>
                        ) : (
                          'Pending'
                        )}
                      </span>
                    </div>
                    {retInfo && (
                      <div className="adm-modal-info-row">
                        <span className="lbl">Return Status:</span>
                        <span className="val">
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              background: retInfo.bg,
                              color: retInfo.color,
                              border: `1px solid ${retInfo.border}`
                            }}
                          >
                            ↩ {retInfo.label}
                          </span>
                        </span>
                      </div>
                    )}
                    <div className="adm-modal-info-row">
                      <span className="lbl">Submission Date:</span>
                      <span className="val">
                        {modalOrder.courier_submitted_at
                          ? new Date(modalOrder.courier_submitted_at).toLocaleString()
                          : '—'}
                      </span>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '12.5px', color: modalOrder.courier_last_error ? '#b91c1c' : '#475569', padding: '4px 0' }}>
                    {modalOrder.courier_last_error
                      ? `Last booking attempt failed: ${modalOrder.courier_last_error}`
                      : 'Not yet submitted to eShipFirst. Confirming this order with Auto-Submit enabled or clicking "Send to eShipFirst" will book a parcel automatically.'}
                  </div>
                )}

                {eshipFraudScore && (
                  <div style={{ marginTop: '8px', padding: '8px 10px', borderRadius: '8px', background: eshipFraudScore.success ? '#f0fdf4' : '#fef2f2', border: `1px solid ${eshipFraudScore.success ? '#bbf7d0' : '#fecaca'}`, fontSize: '12px' }}>
                    <strong>eShipFirst Fraud Score:</strong>{' '}
                    {eshipFraudScore.success
                      ? JSON.stringify(eshipFraudScore.data)
                      : eshipFraudScore.error}
                  </div>
                )}
              </div>

              {/* BD Courier Verification Card (Official Courier Ratio Intelligence) */}
              <div className="adm-modal-section" style={{ padding: 0, border: 'none', background: 'transparent' }}>
                <CourierStatsCard
                  data={selectedCheck?.data}
                  loading={checkingPhone === modalOrder.phone}
                  status={selectedCheck?.status || (checkingPhone === modalOrder.phone ? 'loading' : 'unverified')}
                  error={selectedCheck?.error}
                  retrievedAt={selectedCheck?.completed_at || selectedCheck?.created_at}
                  onSync={() => handleTriggerCourierCheck(modalOrder)}
                  phone={modalOrder.phone}
                />
              </div>

              {/* Multiple Orders with Same Phone Indicator */}
              {samePhoneOrders.length > 1 && (
                <div className="adm-modal-repeat-card">
                  <div className="adm-repeat-title">
                    🔄 Total {samePhoneOrders.length} orders found with this phone number:
                  </div>
                  <div className="adm-repeat-chips">
                    {samePhoneOrders.map((o) => (
                      <span
                        key={o.order_id}
                        className={`adm-repeat-chip ${o.order_id === modalOrder.order_id ? 'current' : ''}`}
                      >
                        #{o.order_id} ({o.status || 'pending'})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Customer Box */}
              <div className="adm-modal-info-card">
                <div className="adm-modal-info-heading">Customer Contact Details:</div>
                <div className="adm-modal-info-row">
                  <span className="lbl">Name:</span>
                  <span className="val bold">{modalOrder.name}</span>
                </div>
                <div className="adm-modal-info-row">
                  <span className="lbl">Phone:</span>
                  <span className="val">
                    <a href={`tel:${modalOrder.phone}`} className="adm-phone-link">
                      <Phone size={13} />
                      {modalOrder.phone}
                    </a>
                  </span>
                </div>
                <div className="adm-modal-info-row">
                  <span className="lbl">Address:</span>
                  <span className="val">{modalOrder.address}</span>
                </div>
                <div className="adm-modal-info-row">
                  <span className="lbl">Area:</span>
                  <span className="val">{modalOrder.area || 'Outside Dhaka'}</span>
                </div>
              </div>

              {/* Order Items & Breakdown */}
              <div className="adm-modal-info-card">
                <div className="adm-modal-info-heading">Order Summary:</div>
                <div className="adm-modal-calc-row">
                  <span>{modalOrder.package_name || modalOrder.product_name || 'খাঁটি খেজুরের গুড়'}</span>
                  <span className="bold">× {getEffectiveOrderQty(modalOrder)}</span>
                </div>
                <div className="adm-modal-calc-row">
                  <span>Unit Price:</span>
                  <span>৳ {modalOrder.unit_price}</span>
                </div>
                <div className="adm-modal-calc-row free">
                  <span>Delivery Charge:</span>
                  <span>{Number(modalOrder.delivery_charge || 0) === 0 ? 'Free (৳0)' : `৳ ${modalOrder.delivery_charge}`}</span>
                </div>
                <div className="adm-modal-calc-divider"></div>
                <div className="adm-modal-calc-total">
                  <span>Total Amount:</span>
                  <span>৳ {modalOrder.total_price}</span>
                </div>
              </div>

              {/* Status Update Quick Buttons */}
              <div className="adm-modal-status-grid">
                <button
                  type="button"
                  className="adm-btn adm-modal-status-btn confirmed"
                  disabled={submittingCourierOrderId === modalKey}
                  onClick={() => handleOrderStatusChange(modalOrder, 'confirmed')}
                >
                  {submittingCourierOrderId === modalKey ? '⏳ Confirming & Booking...' : '✓ Mark Confirmed'}
                </button>
                <button
                  type="button"
                  className="adm-btn adm-modal-status-btn shipped"
                  onClick={() => handleOrderStatusChange(modalOrder, 'shipped')}
                >
                  🚚 Mark Shipped
                </button>
                <button
                  type="button"
                  className="adm-btn adm-modal-status-btn delivered"
                  onClick={() => handleOrderStatusChange(modalOrder, 'delivered')}
                >
                  🎉 Mark Delivered
                </button>
                <button
                  type="button"
                  className="adm-btn adm-modal-status-btn cancelled"
                  onClick={() => handleOrderStatusChange(modalOrder, 'cancelled')}
                >
                  ✕ Mark Cancelled
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* 4. THERMAL STICKER PRINT PREVIEW & PRINT ENGINE MODAL */}
      <ThermalPrintModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        orders={ordersToPrint}
        siteSettings={siteSettings}
        onPrinted={() => setPrintedVersion(Date.now())}
      />

      {/* 5. CREATE MANUAL ORDER MODAL */}
      {isCreateModalOpen && (
        <CreateOrderModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onOrderCreated={handleOrderCreated}
          onOpenPrint={handleOpenPrintFromCreate}
        />
      )}
    </div>
  );
}
