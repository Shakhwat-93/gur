import React, { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Search,
  RotateCw,
  Printer,
  Download,
  FileSpreadsheet,
  Eye,
  MapPin,
  Phone,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Package,
  RefreshCw,
  Wallet,
  ShieldCheck,
  Undo2,
  Send,
  Activity,
  ExternalLink,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Calendar,
  FileText
} from 'lucide-react';
import { useCms } from '../../context/CmsContext';
import ThermalPrintModal from '../components/ThermalPrintModal';
import {
  DELIVERY_STATUS_META,
  getDeliveryStatusInfo,
  getReturnStatusInfo,
  fetchEShipFirstParcels,
  createEShipFirstParcel,
  refreshEShipFirstParcelStatus,
  bulkRefreshEShipFirstParcels,
  fetchEShipFirstTracking,
  fetchEShipFirstLiveStats,
  fetchEShipFirstParcelStates,
  createEShipFirstPickup,
  createEShipFirstReturn,
  fetchEShipFirstReturnRequests,
  fetchEShipFirstPayments,
  fetchEShipFirstFraudScore,
  fetchEShipFirstLogs
} from '../lib/eshipfirstClient';
import { exportParcelsToCsv, exportParcelsToXlsx } from '../lib/exportParcels';

const PAGE_SIZE = 15;

function toPrintableOrder(parcel) {
  const base = parcel.order || {};
  return {
    ...base,
    id: base.id || parcel.order_db_id || parcel.order_id,
    order_id: parcel.order_id || base.order_id,
    consignment_id: parcel.consignment_id || base.consignment_id || '',
    tracking_code: parcel.tracking_code || base.tracking_code || '',
    courier_provider: 'eshipfirst',
    name: base.name || parcel.recipient_name || '',
    phone: base.phone || parcel.recipient_phone || '',
    address: base.address || parcel.recipient_address || '',
    total_price: base.total_price ?? parcel.cod_amount ?? 0,
    status: base.status || 'confirmed',
    created_at: base.created_at || parcel.courier_submitted_at || parcel.created_at
  };
}

export default function CourierManagement({ onNavigateTab, onViewOriginalOrder }) {
  const { siteSettings, showToast, refreshAll } = useCms();

  const [activeSubTab, setActiveSubTab] = useState('parcels'); // parcels | states | pickup_returns | payments | fraud | logs
  const [loading, setLoading] = useState(true);
  const [parcels, setParcels] = useState([]);
  const [stats, setStats] = useState({
    total_submitted: 0,
    pending: 0,
    in_review: 0,
    delivered: 0,
    partial_delivered: 0,
    cancelled: 0,
    returned: 0,
    failed: 0
  });
  const [config, setConfig] = useState(null);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('all');
  const [bookingFilter, setBookingFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkRefreshing, setBulkRefreshing] = useState(false);
  const [refreshingId, setRefreshingId] = useState(null);
  const [retryingId, setRetryingId] = useState(null);

  // Print Modal
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [ordersToPrint, setOrdersToPrint] = useState([]);

  // Parcel Detail & Tracking Modal
  const [activeParcel, setActiveParcel] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingData, setTrackingData] = useState(null);

  // Live States & Stats Tab
  const [liveStatsLoading, setLiveStatsLoading] = useState(false);
  const [liveStats, setLiveStats] = useState(null);
  const [selectedPortalState, setSelectedPortalState] = useState('');
  const [portalStateData, setPortalStateData] = useState(null);
  const [portalStateLoading, setPortalStateLoading] = useState(false);

  // Pickup & Returns Tab
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupNote, setPickupNote] = useState('');
  const [pickupSubmitting, setPickupSubmitting] = useState(false);
  const [returnCid, setReturnCid] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnRequests, setReturnRequests] = useState(null);
  const [returnRequestsLoading, setReturnRequestsLoading] = useState(false);

  // Payments Tab
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsData, setPaymentsData] = useState(null);
  const [paymentDetailId, setPaymentDetailId] = useState('');
  const [paymentDetail, setPaymentDetail] = useState(null);

  // Fraud Check Tab
  const [fraudPhone, setFraudPhone] = useState('');
  const [fraudLoading, setFraudLoading] = useState(false);
  const [fraudResult, setFraudResult] = useState(null);

  // API Logs Tab
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const loadParcels = async () => {
    try {
      setLoading(true);
      const { ok, data } = await fetchEShipFirstParcels();
      if (ok && data?.success) {
        setParcels(data.parcels || []);
        if (data.stats) setStats(data.stats);
        if (data.config) {
          setConfig(data.config);
          if (!pickupAddress && data.config.default_pickup_address) {
            setPickupAddress(data.config.default_pickup_address);
          }
        }
      } else {
        showToast?.(data?.error || 'Failed to load courier parcels', 'error');
      }
    } catch (err) {
      showToast?.(err.message || 'Network error loading courier data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadParcels();
  }, []);

  // Load sub-tab specific live data on demand
  useEffect(() => {
    if (activeSubTab === 'states' && !liveStats) {
      handleLoadLiveStats();
    } else if (activeSubTab === 'pickup_returns' && !returnRequests) {
      handleLoadReturnRequests();
    } else if (activeSubTab === 'payments' && !paymentsData) {
      handleLoadPayments();
    } else if (activeSubTab === 'logs') {
      handleLoadLogs();
    }
  }, [activeSubTab]);

  // Filtered parcels
  const filteredParcels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return parcels.filter((p) => {
      if (q) {
        const matchOrder = String(p.order_id || '').toLowerCase().includes(q);
        const matchCid = String(p.consignment_id || '').toLowerCase().includes(q);
        const matchTrack = String(p.tracking_code || '').toLowerCase().includes(q);
        const matchPhone = String(p.recipient_phone || p.order?.phone || '').toLowerCase().includes(q);
        const matchName = String(p.recipient_name || p.order?.name || '').toLowerCase().includes(q);
        if (!matchOrder && !matchCid && !matchTrack && !matchPhone && !matchName) return false;
      }

      if (bookingFilter !== 'all') {
        const bs = String(p.courier_booking_status || (p.consignment_id ? 'booked' : 'pending')).toLowerCase();
        if (bs !== bookingFilter) return false;
      }

      if (deliveryFilter !== 'all') {
        if (deliveryFilter === 'returned') {
          if (!p.courier_return_status) return false;
        } else {
          const ds = String(p.courier_delivery_status || 'pending').toLowerCase();
          if (ds !== deliveryFilter) return false;
        }
      }

      if (dateFrom || dateTo) {
        const ts = new Date(p.courier_submitted_at || p.created_at || 0).getTime();
        if (dateFrom) {
          const fromTs = new Date(`${dateFrom}T00:00:00`).getTime();
          if (ts < fromTs) return false;
        }
        if (dateTo) {
          const toTs = new Date(`${dateTo}T23:59:59`).getTime();
          if (ts > toTs) return false;
        }
      }

      return true;
    });
  }, [parcels, searchQuery, deliveryFilter, bookingFilter, dateFrom, dateTo]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, deliveryFilter, bookingFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredParcels.length / PAGE_SIZE));
  const paginatedParcels = filteredParcels.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Checkbox selection helpers
  const toggleSelectOne = (id) => {
    const key = String(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allOnPageSelected =
    paginatedParcels.length > 0 && paginatedParcels.every((p) => selectedIds.has(String(p.order_id)));

  const handleToggleSelectPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        paginatedParcels.forEach((p) => next.delete(String(p.order_id)));
      } else {
        paginatedParcels.forEach((p) => next.add(String(p.order_id)));
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedIds(new Set(filteredParcels.map((p) => String(p.order_id))));
  };

  const selectedParcels = useMemo(
    () => parcels.filter((p) => selectedIds.has(String(p.order_id))),
    [parcels, selectedIds]
  );

  // Actions
  const handleRefreshOne = async (parcel) => {
    const key = String(parcel.order_id);
    setRefreshingId(key);
    try {
      const { ok, data } = await refreshEShipFirstParcelStatus({
        orderId: parcel.order_id,
        consignmentId: parcel.consignment_id,
        trackingCode: parcel.tracking_code,
        invoice: parcel.invoice || parcel.order_id
      });
      if (ok && data?.success) {
        if (data.cached) {
          showToast?.(data.message || 'Recently synced (60s API cache active)');
        } else {
          showToast?.(`Status synced: ${data.delivery_status || 'Updated'}`);
          await loadParcels();
          refreshAll?.();
        }
      } else {
        showToast?.(data?.error || 'Failed to sync status', 'error');
      }
    } catch (err) {
      showToast?.(err.message || 'Status sync error', 'error');
    } finally {
      setRefreshingId(null);
    }
  };

  const handleBulkRefresh = async () => {
    const targets = selectedParcels.filter((p) => p.consignment_id || p.tracking_code);
    if (targets.length === 0) {
      showToast?.('Select booked parcels with a Consignment ID to refresh.', 'error');
      return;
    }
    setBulkRefreshing(true);
    try {
      const { ok, data } = await bulkRefreshEShipFirstParcels(
        targets.map((p) => ({
          order_id: p.order_id,
          consignment_id: p.consignment_id,
          tracking_code: p.tracking_code,
          invoice: p.invoice || p.order_id
        }))
      );
      if (ok && data?.success) {
        showToast?.(
          `Synced ${data.refreshed_count} parcel(s)${data.cached_count ? ` (${data.cached_count} cached <60s)` : ''}${data.failed_count ? `, ${data.failed_count} failed` : ''}.`
        );
        await loadParcels();
        refreshAll?.();
      } else {
        showToast?.(data?.error || 'Bulk refresh failed', 'error');
      }
    } catch (err) {
      showToast?.(err.message || 'Bulk refresh error', 'error');
    } finally {
      setBulkRefreshing(false);
    }
  };

  const handleRetryBooking = async (parcel) => {
    const key = String(parcel.order_id);
    setRetryingId(key);
    try {
      const { ok, data } = await createEShipFirstParcel(parcel.order_id, parcel.order || null, true);
      if (ok && data?.success) {
        showToast?.(data.message || 'Parcel booked successfully!');
        await loadParcels();
        refreshAll?.();
      } else {
        showToast?.(data?.error || 'Retry booking failed', 'error');
      }
    } catch (err) {
      showToast?.(err.message || 'Retry error', 'error');
    } finally {
      setRetryingId(null);
    }
  };

  const handleOpenTrackModal = async (parcel) => {
    setActiveParcel(parcel);
    setTrackingData(null);
    if (!parcel.consignment_id && !parcel.tracking_code) return;
    setTrackingLoading(true);
    try {
      const { ok, data } = await fetchEShipFirstTracking({
        invoice: parcel.invoice || parcel.order_id,
        consignmentId: parcel.consignment_id,
        trackingCode: parcel.tracking_code
      });
      if (ok && data?.success) {
        setTrackingData(data.tracking);
      } else {
        setTrackingData({ error: data?.error || 'Failed to load tracking timeline' });
      }
    } catch (err) {
      setTrackingData({ error: err.message });
    } finally {
      setTrackingLoading(false);
    }
  };

  const handlePrintSingle = (parcel) => {
    setOrdersToPrint([toPrintableOrder(parcel)]);
    setPrintModalOpen(true);
  };

  const handleBulkPrintSelected = () => {
    if (selectedParcels.length === 0) {
      showToast?.('Select at least one parcel to print.', 'error');
      return;
    }
    setOrdersToPrint(selectedParcels.map(toPrintableOrder));
    setPrintModalOpen(true);
  };

  const handlePrintAllFiltered = () => {
    const bookedFiltered = filteredParcels.filter((p) => p.consignment_id);
    const list = bookedFiltered.length > 0 ? bookedFiltered : filteredParcels;
    if (list.length === 0) {
      showToast?.('No matching parcels to print.', 'error');
      return;
    }
    setOrdersToPrint(list.map(toPrintableOrder));
    setPrintModalOpen(true);
  };

  const handleExportCsv = () => {
    const target = selectedParcels.length > 0 ? selectedParcels : filteredParcels;
    if (target.length === 0) {
      showToast?.('No parcels available to export.', 'error');
      return;
    }
    exportParcelsToCsv(target);
    showToast?.(`Exported ${target.length} parcel(s) to CSV.`);
  };

  const handleExportXlsx = () => {
    const target = selectedParcels.length > 0 ? selectedParcels : filteredParcels;
    if (target.length === 0) {
      showToast?.('No parcels available to export.', 'error');
      return;
    }
    exportParcelsToXlsx(target);
    showToast?.(`Exported ${target.length} parcel(s) to Excel (.xlsx).`);
  };

  // Sub-tab API handlers
  const handleLoadLiveStats = async () => {
    setLiveStatsLoading(true);
    try {
      const { data } = await fetchEShipFirstLiveStats();
      setLiveStats(data);
    } catch (err) {
      setLiveStats({ success: false, error: err.message });
    } finally {
      setLiveStatsLoading(false);
    }
  };

  const handleSelectPortalState = async (stateName) => {
    setSelectedPortalState(stateName);
    setPortalStateLoading(true);
    try {
      const { data } = await fetchEShipFirstParcelStates(stateName);
      setPortalStateData(data);
    } catch (err) {
      setPortalStateData({ success: false, error: err.message });
    } finally {
      setPortalStateLoading(false);
    }
  };

  const handleSubmitPickup = async (e) => {
    e.preventDefault();
    setPickupSubmitting(true);
    try {
      const { ok, data } = await createEShipFirstPickup({
        address: pickupAddress.trim(),
        note: pickupNote.trim()
      });
      if (ok && data?.success) {
        showToast?.('Pickup request submitted to eShipFirst!');
        setPickupNote('');
      } else {
        showToast?.(data?.error || 'Pickup request failed', 'error');
      }
    } catch (err) {
      showToast?.(err.message, 'error');
    } finally {
      setPickupSubmitting(false);
    }
  };

  const handleSubmitReturn = async (e) => {
    e.preventDefault();
    if (!returnCid.trim()) {
      showToast?.('Consignment ID is required for a return request.', 'error');
      return;
    }
    setReturnSubmitting(true);
    try {
      const { ok, data } = await createEShipFirstReturn({
        consignment_id: returnCid.trim(),
        reason: returnReason.trim()
      });
      if (ok && data?.success) {
        showToast?.('Return request created successfully!');
        setReturnCid('');
        setReturnReason('');
        handleLoadReturnRequests();
      } else {
        showToast?.(data?.error || 'Return request failed', 'error');
      }
    } catch (err) {
      showToast?.(err.message, 'error');
    } finally {
      setReturnSubmitting(false);
    }
  };

  const handleLoadReturnRequests = async () => {
    setReturnRequestsLoading(true);
    try {
      const { data } = await fetchEShipFirstReturnRequests();
      setReturnRequests(data);
    } catch (err) {
      setReturnRequests({ success: false, error: err.message });
    } finally {
      setReturnRequestsLoading(false);
    }
  };

  const handleLoadPayments = async () => {
    setPaymentsLoading(true);
    try {
      const { data } = await fetchEShipFirstPayments();
      setPaymentsData(data);
    } catch (err) {
      setPaymentsData({ success: false, error: err.message });
    } finally {
      setPaymentsLoading(false);
    }
  };

  const handleLookupPayment = async (e) => {
    e.preventDefault();
    if (!paymentDetailId.trim()) return;
    setPaymentsLoading(true);
    try {
      const { data } = await fetchEShipFirstPayments(paymentDetailId.trim());
      setPaymentDetail(data);
    } catch (err) {
      setPaymentDetail({ success: false, error: err.message });
    } finally {
      setPaymentsLoading(false);
    }
  };

  const handleCheckFraud = async (e) => {
    e.preventDefault();
    if (!fraudPhone.trim()) return;
    setFraudLoading(true);
    setFraudResult(null);
    try {
      const { data } = await fetchEShipFirstFraudScore(fraudPhone.trim());
      setFraudResult(data);
    } catch (err) {
      setFraudResult({ success: false, error: err.message });
    } finally {
      setFraudLoading(false);
    }
  };

  const handleLoadLogs = async () => {
    setLogsLoading(true);
    try {
      const { ok, data } = await fetchEShipFirstLogs(80);
      if (ok && data?.logs) setLogs(data.logs);
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  };

  const statCards = [
    { label: 'Total Submitted', value: stats.total_submitted, color: '#0f172a', bg: '#f8fafc', border: '#cbd5e1', filter: 'all' },
    { label: 'Pending', value: stats.pending, color: '#92400e', bg: '#fffbeb', border: '#fde68a', filter: 'pending' },
    { label: 'In Review', value: stats.in_review, color: '#075985', bg: '#f0f9ff', border: '#bae6fd', filter: 'in_review' },
    { label: 'Delivered', value: stats.delivered, color: '#166534', bg: '#f0fdf4', border: '#bbf7d0', filter: 'delivered' },
    { label: 'Partial Delivered', value: stats.partial_delivered, color: '#065f46', bg: '#ecfdf5', border: '#a7f3d0', filter: 'partial_delivered' },
    { label: 'Cancelled', value: stats.cancelled, color: '#991b1b', bg: '#fef2f2', border: '#fecaca', filter: 'cancelled' },
    { label: 'Returned', value: stats.returned, color: '#6b21a8', bg: '#faf5ff', border: '#e9d5ff', filter: 'returned' },
    { label: 'Failed Bookings', value: stats.failed, color: '#b91c1c', bg: '#fff1f2', border: '#fecdd3', filter: 'failed_booking' }
  ];

  return (
    <div className="easy-page-wrap">
      {/* Header Bar */}
      <div
        className="adm-page-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 className="adm-page-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Truck size={22} color="#0284c7" /> Courier Management
            </h2>
            {config?.connection_status === 'connected' ? (
              <span className="adm-badge adm-badge-success">● eShipFirst Connected</span>
            ) : (
              <span className="adm-badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                ○ {config?.connection_status === 'failed' ? 'Connection Failed' : 'Not Connected'}
              </span>
            )}
            {config?.current_balance !== null && config?.current_balance !== undefined && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  color: '#0369a1',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  fontSize: '12.5px',
                  fontWeight: 800
                }}
              >
                <Wallet size={13} /> ৳{Number(config.current_balance).toLocaleString('en-IN')}
              </span>
            )}
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
            eShipFirst Consignment Dashboard · Bulk Thermal Label Printing · CSV/Excel Export · Real-Time Delivery Tracking
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="adm-btn"
            onClick={() => onNavigateTab?.('courier')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <SlidersHorizontal size={15} />
            <span>Courier Settings</span>
          </button>
          <button
            type="button"
            className="adm-btn"
            onClick={loadParcels}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RotateCw size={15} className={loading ? 'easy-spinning' : ''} />
            <span>Reload</span>
          </button>
        </div>
      </div>

      {/* Dashboard Statistics Grid (8 Real KPI Cards) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
          gap: '10px',
          marginBottom: '18px'
        }}
      >
        {statCards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => {
              setActiveSubTab('parcels');
              if (card.filter === 'failed_booking') {
                setBookingFilter('failed');
                setDeliveryFilter('all');
              } else {
                setBookingFilter('all');
                setDeliveryFilter(card.filter);
              }
            }}
            style={{
              textAlign: 'left',
              padding: '12px 14px',
              borderRadius: '12px',
              background: card.bg,
              border: `1.2px solid ${card.border}`,
              cursor: 'pointer',
              transition: 'transform 0.15s ease'
            }}
          >
            <div style={{ fontSize: '11.5px', fontWeight: 700, color: card.color, opacity: 0.9 }}>{card.label}</div>
            <div style={{ fontSize: '22px', fontWeight: 900, color: card.color, marginTop: '4px', lineHeight: 1.1 }}>
              {card.value}
            </div>
          </button>
        ))}
      </div>

      {/* Sub-Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '6px',
          marginBottom: '16px',
          borderBottom: '1px solid #e2e8f0'
        }}
      >
        {[
          { id: 'parcels', label: `Submitted Parcels (${parcels.length})`, icon: Package },
          { id: 'states', label: 'Live States & Stats', icon: Activity },
          { id: 'pickup_returns', label: 'Pickup & Returns', icon: Undo2 },
          { id: 'payments', label: 'Balance & Payments', icon: Wallet },
          { id: 'fraud', label: 'Fraud Score Check', icon: ShieldCheck },
          { id: 'logs', label: 'API Logs', icon: FileText }
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: active ? 800 : 600,
                border: active ? '1.5px solid #0284c7' : '1px solid transparent',
                background: active ? '#f0f9ff' : 'transparent',
                color: active ? '#0369a1' : '#475569',
                whiteSpace: 'nowrap',
                cursor: 'pointer'
              }}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: PARCEL LISTING, FILTERS, BULK PRINT & BULK EXPORT              */}
      {/* ===================================================================== */}
      {activeSubTab === 'parcels' && (
        <>
          {/* Filter & Action Toolbar Card */}
          <div className="adm-card" style={{ marginBottom: '14px' }}>
            <div className="adm-card-body" style={{ padding: '14px 16px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
                  gap: '10px',
                  marginBottom: '12px'
                }}
              >
                <div style={{ position: 'relative', gridColumn: 'span 2' }}>
                  <Search size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input
                    type="text"
                    className="adm-input"
                    style={{ paddingLeft: '34px' }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Order ID, Consignment ID, Tracking Code, or Phone..."
                  />
                </div>

                <select
                  className="adm-input"
                  value={deliveryFilter}
                  onChange={(e) => setDeliveryFilter(e.target.value)}
                  aria-label="Filter by delivery status"
                >
                  <option value="all">All Delivery Statuses</option>
                  {Object.entries(DELIVERY_STATUS_META).map(([key, meta]) => (
                    <option key={key} value={key}>{meta.label}</option>
                  ))}
                  <option value="returned">Has Return Status</option>
                </select>

                <select
                  className="adm-input"
                  value={bookingFilter}
                  onChange={(e) => setBookingFilter(e.target.value)}
                  aria-label="Filter by booking status"
                >
                  <option value="all">All Booking Statuses</option>
                  <option value="booked">Booked (Success)</option>
                  <option value="failed">Failed Submission</option>
                  <option value="submitting">Submitting</option>
                </select>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="date"
                    className="adm-input"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    title="From date"
                  />
                  <input
                    type="date"
                    className="adm-input"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    title="To date"
                  />
                </div>
              </div>

              {/* Bulk Actions Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#334155' }}>
                    {selectedIds.size > 0
                      ? `${selectedIds.size} parcel(s) selected`
                      : `Showing ${filteredParcels.length} parcel(s)`}
                  </span>
                  {filteredParcels.length > 0 && selectedIds.size < filteredParcels.length && (
                    <button type="button" className="adm-btn adm-btn-sm" onClick={handleSelectAllFiltered}>
                      Select All Filtered ({filteredParcels.length})
                    </button>
                  )}
                  {selectedIds.size > 0 && (
                    <button type="button" className="adm-btn adm-btn-sm" onClick={() => setSelectedIds(new Set())}>
                      Clear
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="adm-btn adm-btn-sm"
                    onClick={handleBulkRefresh}
                    disabled={bulkRefreshing || selectedIds.size === 0}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <RefreshCw size={14} className={bulkRefreshing ? 'easy-spinning' : ''} />
                    <span>Refresh Selected</span>
                  </button>

                  <button
                    type="button"
                    className="adm-btn adm-btn-sm"
                    onClick={handleBulkPrintSelected}
                    disabled={selectedIds.size === 0}
                    style={{
                      background: selectedIds.size > 0 ? '#0f172a' : undefined,
                      color: selectedIds.size > 0 ? '#ffffff' : undefined,
                      borderColor: selectedIds.size > 0 ? '#0f172a' : undefined,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontWeight: 700
                    }}
                  >
                    <Printer size={14} />
                    <span>Print Selected ({selectedIds.size})</span>
                  </button>

                  <button
                    type="button"
                    className="adm-btn adm-btn-sm"
                    onClick={handlePrintAllFiltered}
                    disabled={filteredParcels.length === 0}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 700 }}
                  >
                    <Printer size={14} />
                    <span>Print All Matching ({filteredParcels.length})</span>
                  </button>

                  <button
                    type="button"
                    className="adm-btn adm-btn-sm"
                    onClick={handleExportCsv}
                    disabled={filteredParcels.length === 0}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <Download size={14} />
                    <span>Export CSV</span>
                  </button>

                  <button
                    type="button"
                    className="adm-btn adm-btn-sm"
                    onClick={handleExportXlsx}
                    disabled={filteredParcels.length === 0}
                    style={{
                      background: '#059669',
                      color: '#ffffff',
                      borderColor: '#059669',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontWeight: 700
                    }}
                  >
                    <FileSpreadsheet size={14} />
                    <span>Export XLSX</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Parcels Table Card */}
          <div className="adm-card">
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                Loading eShipFirst parcels...
              </div>
            ) : paginatedParcels.length === 0 ? (
              <div style={{ padding: '44px 20px', textAlign: 'center', color: '#64748b' }}>
                <Truck size={36} style={{ opacity: 0.35, marginBottom: '10px' }} />
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#334155' }}>
                  No eShipFirst parcels found
                </div>
                <p style={{ fontSize: '13px', margin: '6px 0 0' }}>
                  Confirm an order in Orders Manager (with Auto-Submit enabled) or send an order manually to eShipFirst.
                </p>
              </div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table className="adm-table" style={{ width: '100%', minWidth: '960px' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '36px' }}>
                          <input
                            type="checkbox"
                            className="adm-checkbox"
                            checked={allOnPageSelected}
                            onChange={handleToggleSelectPage}
                            aria-label="Select all parcels on page"
                          />
                        </th>
                        <th>Internal Order ID</th>
                        <th>eShipFirst Consignment ID</th>
                        <th>Customer Name</th>
                        <th>Phone Number</th>
                        <th>Delivery Address</th>
                        <th>COD Amount</th>
                        <th>Submission Date</th>
                        <th>Courier Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedParcels.map((p) => {
                        const key = String(p.order_id);
                        const isSelected = selectedIds.has(key);
                        const delInfo = getDeliveryStatusInfo(p.courier_delivery_status);
                        const retInfo = getReturnStatusInfo(p.courier_return_status);
                        const isFailed = p.courier_booking_status === 'failed' && !p.consignment_id;

                        return (
                          <tr key={key} className={isSelected ? 'adm-row-selected' : ''}>
                            <td>
                              <input
                                type="checkbox"
                                className="adm-checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectOne(key)}
                                aria-label={`Select parcel ${p.consignment_id || key}`}
                              />
                            </td>
                            <td style={{ fontFamily: 'monospace', fontSize: '12.5px', fontWeight: 700, color: '#475569' }}>
                              #{p.order_id}
                            </td>
                            <td>
                              {p.consignment_id ? (
                                <div>
                                  <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '14px', color: '#0369a1' }}>
                                    #{p.consignment_id}
                                  </div>
                                  {p.tracking_code && (
                                    <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64748b' }}>
                                      TRK: {p.tracking_code}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 700 }}>
                                  Booking Failed
                                </span>
                              )}
                            </td>
                            <td style={{ fontWeight: 700, color: '#0f172a' }}>
                              {p.recipient_name || p.order?.name || '—'}
                            </td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              <a href={`tel:${p.recipient_phone || p.order?.phone}`} style={{ color: '#0f172a', textDecoration: 'none' }}>
                                {p.recipient_phone || p.order?.phone || '—'}
                              </a>
                            </td>
                            <td style={{ maxWidth: '220px', fontSize: '12.5px', color: '#334155' }}>
                              {p.recipient_address || p.order?.address || '—'}
                            </td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 800, whiteSpace: 'nowrap' }}>
                              ৳ {Number(p.cod_amount ?? p.order?.total_price ?? 0).toLocaleString('en-IN')}
                            </td>
                            <td style={{ fontSize: '12px', color: '#475569', whiteSpace: 'nowrap' }}>
                              {p.courier_submitted_at || p.created_at
                                ? new Date(p.courier_submitted_at || p.created_at).toLocaleString('en-GB', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                : '—'}
                            </td>
                            <td>
                              {isFailed ? (
                                <div>
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      padding: '3px 8px',
                                      borderRadius: '999px',
                                      fontSize: '11.5px',
                                      fontWeight: 700,
                                      background: '#fee2e2',
                                      color: '#991b1b',
                                      border: '1px solid #fecaca'
                                    }}
                                  >
                                    Failed
                                  </span>
                                  {p.last_error && (
                                    <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '3px', maxWidth: '180px' }}>
                                      {p.last_error}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      padding: '3px 8px',
                                      borderRadius: '999px',
                                      fontSize: '11.5px',
                                      fontWeight: 700,
                                      background: delInfo.bg,
                                      color: delInfo.color,
                                      border: `1px solid ${delInfo.border}`
                                    }}
                                    title={`Raw API Status: ${p.courier_delivery_status || 'pending'}`}
                                  >
                                    {delInfo.label}
                                  </span>
                                  {retInfo && (
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        padding: '2px 7px',
                                        borderRadius: '999px',
                                        fontSize: '10.5px',
                                        fontWeight: 700,
                                        background: retInfo.bg,
                                        color: retInfo.color,
                                        border: `1px solid ${retInfo.border}`
                                      }}
                                      title={`Return Status: ${p.courier_return_status}`}
                                    >
                                      ↩ {retInfo.label}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'inline-flex', gap: '5px', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  className="adm-btn adm-btn-sm"
                                  onClick={() => handleOpenTrackModal(p)}
                                  title="View Details & Track Parcel"
                                >
                                  <Eye size={14} />
                                </button>
                                {isFailed ? (
                                  <button
                                    type="button"
                                    className="adm-btn adm-btn-sm"
                                    disabled={retryingId === key}
                                    onClick={() => handleRetryBooking(p)}
                                    style={{ background: '#0284c7', color: '#fff', borderColor: '#0284c7' }}
                                    title="Retry booking with eShipFirst"
                                  >
                                    <Send size={13} /> {retryingId === key ? '...' : 'Retry'}
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className="adm-btn adm-btn-sm"
                                      disabled={refreshingId === key}
                                      onClick={() => handleRefreshOne(p)}
                                      title="Refresh Delivery Status (60s API cache)"
                                    >
                                      <RefreshCw size={14} className={refreshingId === key ? 'easy-spinning' : ''} />
                                    </button>
                                    <button
                                      type="button"
                                      className="adm-btn adm-btn-sm"
                                      onClick={() => handlePrintSingle(p)}
                                      style={{ background: '#0f172a', color: '#fff', borderColor: '#0f172a' }}
                                      title="Print Courier Thermal Label"
                                    >
                                      <Printer size={14} />
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  className="adm-btn adm-btn-sm"
                                  onClick={() =>
                                    onViewOriginalOrder
                                      ? onViewOriginalOrder(p.order_id)
                                      : onNavigateTab?.('orders')
                                  }
                                  title="View Original Order"
                                >
                                  <ExternalLink size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      borderTop: '1px solid #e2e8f0',
                      fontSize: '13px',
                      color: '#475569'
                    }}
                  >
                    <span>
                      Page {currentPage} of {totalPages} ({filteredParcels.length} total)
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="adm-btn adm-btn-sm"
                        disabled={currentPage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft size={15} /> Prev
                      </button>
                      <button
                        type="button"
                        className="adm-btn adm-btn-sm"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Next <ChevronRight size={15} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: LIVE PARCEL STATES & STATS (GET /stats, /parcel_states)        */}
      {/* ===================================================================== */}
      {activeSubTab === 'states' && (
        <div className="adm-card">
          <div className="adm-card-header" style={{ justifyContent: 'space-between' }}>
            <h3 className="adm-card-title" style={{ margin: 0 }}>Live eShipFirst Portal Statistics &amp; States</h3>
            <button type="button" className="adm-btn adm-btn-sm" onClick={handleLoadLiveStats} disabled={liveStatsLoading}>
              <RotateCw size={14} className={liveStatsLoading ? 'easy-spinning' : ''} /> Sync Live Stats
            </button>
          </div>
          <div className="adm-card-body">
            {liveStatsLoading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Fetching live stats from eShipFirst API...</div>
            ) : !liveStats || liveStats.error ? (
              <div style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', fontSize: '13px' }}>
                {liveStats?.error || 'Connect your eShipFirst API credentials in Courier Settings to view live portal statistics.'}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                <div>
                  <h4 style={{ margin: '0 0 8px', fontSize: '14px' }}>Inspect Parcels by State (GET /parcel_states/{'{state}'})</h4>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    {['pending', 'in_review', 'delivered', 'partial_delivered', 'cancelled', 'hold'].map((st) => (
                      <button
                        key={st}
                        type="button"
                        className="adm-btn adm-btn-sm"
                        onClick={() => handleSelectPortalState(st)}
                        style={selectedPortalState === st ? { background: '#0284c7', color: '#fff', borderColor: '#0284c7' } : undefined}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                  {portalStateLoading && <div style={{ fontSize: '13px', color: '#64748b' }}>Loading state parcels...</div>}
                  {portalStateData && !portalStateLoading && (
                    <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: '12px', borderRadius: '8px', fontSize: '12px', overflowX: 'auto', maxHeight: '260px' }}>
                      {JSON.stringify(portalStateData, null, 2)}
                    </pre>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 6px', fontSize: '13.5px' }}>GET /stats Response</h4>
                    <pre style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px', fontSize: '12px', overflowX: 'auto', maxHeight: '240px' }}>
                      {JSON.stringify(liveStats.stats, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 6px', fontSize: '13.5px' }}>GET /parcel_states Response</h4>
                    <pre style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px', fontSize: '12px', overflowX: 'auto', maxHeight: '240px' }}>
                      {JSON.stringify(liveStats.parcel_states, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: PICKUP & RETURN REQUESTS                                       */}
      {/* ===================================================================== */}
      {activeSubTab === 'pickup_returns' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          <div className="adm-card">
            <div className="adm-card-header">
              <h3 className="adm-card-title" style={{ margin: 0 }}>Request Courier Pickup (POST /create_pickup_request)</h3>
            </div>
            <div className="adm-card-body">
              <form onSubmit={handleSubmitPickup} style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <label className="adm-label">Pickup Address</label>
                  <input
                    type="text"
                    className="adm-input"
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    placeholder="Warehouse / pickup address"
                    required
                  />
                </div>
                <div>
                  <label className="adm-label">Pickup Note (Optional)</label>
                  <textarea
                    className="adm-input"
                    rows={3}
                    value={pickupNote}
                    onChange={(e) => setPickupNote(e.target.value)}
                    placeholder="Parcel count, contact person, or pickup instructions..."
                  />
                </div>
                <button type="submit" className="adm-btn adm-btn-primary" disabled={pickupSubmitting} style={{ background: '#0284c7', borderColor: '#0284c7', color: '#fff' }}>
                  {pickupSubmitting ? 'Submitting Pickup Request...' : 'Request Rider Pickup'}
                </button>
              </form>
            </div>
          </div>

          <div className="adm-card">
            <div className="adm-card-header" style={{ justifyContent: 'space-between' }}>
              <h3 className="adm-card-title" style={{ margin: 0 }}>Return Requests (POST /create_return_request)</h3>
              <button type="button" className="adm-btn adm-btn-sm" onClick={handleLoadReturnRequests} disabled={returnRequestsLoading}>
                <RotateCw size={13} className={returnRequestsLoading ? 'easy-spinning' : ''} /> Refresh
              </button>
            </div>
            <div className="adm-card-body">
              <form onSubmit={handleSubmitReturn} style={{ display: 'grid', gap: '10px', marginBottom: '16px' }}>
                <div>
                  <label className="adm-label">Consignment ID</label>
                  <input
                    type="text"
                    className="adm-input"
                    value={returnCid}
                    onChange={(e) => setReturnCid(e.target.value)}
                    placeholder="e.g. 1424107"
                    required
                  />
                </div>
                <div>
                  <label className="adm-label">Reason (Optional)</label>
                  <input
                    type="text"
                    className="adm-input"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    placeholder="Reason for return request"
                  />
                </div>
                <button type="submit" className="adm-btn" disabled={returnSubmitting} style={{ background: '#0f172a', color: '#fff', borderColor: '#0f172a' }}>
                  {returnSubmitting ? 'Submitting...' : 'Submit Return Request'}
                </button>
              </form>

              {returnRequests && (
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '6px' }}>Return Requests (GET /get_return_requests)</div>
                  <pre style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '8px', fontSize: '11.5px', overflowX: 'auto', maxHeight: '200px' }}>
                    {JSON.stringify(returnRequests, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: BALANCE & PAYMENTS (GET /get_balance, /payments)               */}
      {/* ===================================================================== */}
      {activeSubTab === 'payments' && (
        <div className="adm-card">
          <div className="adm-card-header" style={{ justifyContent: 'space-between' }}>
            <h3 className="adm-card-title" style={{ margin: 0 }}>Merchant Balance &amp; Payment Settlements</h3>
            <button type="button" className="adm-btn adm-btn-sm" onClick={handleLoadPayments} disabled={paymentsLoading}>
              <RotateCw size={14} className={paymentsLoading ? 'easy-spinning' : ''} /> Reload Payments
            </button>
          </div>
          <div className="adm-card-body">
            <form onSubmit={handleLookupPayment} style={{ display: 'flex', gap: '8px', marginBottom: '14px', maxWidth: '420px' }}>
              <input
                type="text"
                className="adm-input"
                value={paymentDetailId}
                onChange={(e) => setPaymentDetailId(e.target.value)}
                placeholder="Lookup Payment ID (GET /payments/{id})"
              />
              <button type="submit" className="adm-btn" disabled={paymentsLoading}>Lookup</button>
            </form>

            {paymentDetail && (
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, marginBottom: '4px' }}>Payment #{paymentDetailId} Details</div>
                <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: '12px', borderRadius: '8px', fontSize: '12px', overflowX: 'auto', maxHeight: '220px' }}>
                  {JSON.stringify(paymentDetail, null, 2)}
                </pre>
              </div>
            )}

            {paymentsLoading ? (
              <div style={{ color: '#64748b', fontSize: '13px' }}>Loading payments...</div>
            ) : (
              <pre style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px', fontSize: '12px', overflowX: 'auto', maxHeight: '300px' }}>
                {JSON.stringify(paymentsData || { message: 'Click Reload Payments to fetch settlement history.' }, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: FRAUD SCORE CHECKER (GET /fraud_check/score/{phone})           */}
      {/* ===================================================================== */}
      {activeSubTab === 'fraud' && (
        <div className="adm-card">
          <div className="adm-card-header">
            <h3 className="adm-card-title" style={{ margin: 0 }}>Customer Delivery &amp; Return History Check (eShipFirst Fraud Score)</h3>
          </div>
          <div className="adm-card-body">
            <form onSubmit={handleCheckFraud} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', maxWidth: '500px', marginBottom: '16px' }}>
              <input
                type="tel"
                className="adm-input"
                style={{ flex: 1, minWidth: '200px' }}
                value={fraudPhone}
                onChange={(e) => setFraudPhone(e.target.value)}
                placeholder="Enter 11-digit phone (e.g. 01712345678)"
                required
              />
              <button
                type="submit"
                className="adm-btn adm-btn-primary"
                disabled={fraudLoading}
                style={{ background: '#0284c7', borderColor: '#0284c7', color: '#fff' }}
              >
                {fraudLoading ? 'Checking...' : 'Check Fraud Score'}
              </button>
            </form>

            {fraudResult && (
              fraudResult.success ? (
                <pre style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '14px', borderRadius: '10px', fontSize: '12.5px', overflowX: 'auto' }}>
                  {JSON.stringify(fraudResult.data, null, 2)}
                </pre>
              ) : (
                <div style={{ padding: '12px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', fontSize: '13px' }}>
                  {fraudResult.error}
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 6: SANITIZED API SUBMISSION & SYNC LOGS                           */}
      {/* ===================================================================== */}
      {activeSubTab === 'logs' && (
        <div className="adm-card">
          <div className="adm-card-header" style={{ justifyContent: 'space-between' }}>
            <h3 className="adm-card-title" style={{ margin: 0 }}>Courier API Audit Logs (Secrets Redacted)</h3>
            <button type="button" className="adm-btn adm-btn-sm" onClick={handleLoadLogs} disabled={logsLoading}>
              <RotateCw size={14} className={logsLoading ? 'easy-spinning' : ''} /> Refresh Logs
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            {logs.length === 0 ? (
              <div style={{ padding: '28px', textAlign: 'center', color: '#64748b' }}>No API logs recorded yet.</div>
            ) : (
              <table className="adm-table" style={{ width: '100%', minWidth: '720px' }}>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Action</th>
                    <th>Endpoint</th>
                    <th>Order / CID</th>
                    <th>Status</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l, idx) => (
                    <tr key={l.id || idx}>
                      <td style={{ fontSize: '11.5px', whiteSpace: 'nowrap', color: '#64748b' }}>
                        {l.created_at ? new Date(l.created_at).toLocaleString() : '—'}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 700 }}>{l.action}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '11.5px', color: '#475569' }}>{l.endpoint || '—'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                        {l.order_id ? `#${l.order_id}` : ''} {l.consignment_id ? `· CID:${l.consignment_id}` : ''}
                      </td>
                      <td>
                        <span
                          className={`adm-badge ${l.success ? 'adm-badge-success' : 'adm-badge-danger'}`}
                          style={{ fontSize: '11px' }}
                        >
                          {l.http_status || (l.success ? 'OK' : 'ERR')}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: '#334155' }}>{l.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* PARCEL DETAILS & TRACKING MODAL                                       */}
      {/* ===================================================================== */}
      {activeParcel && (
        <div className="adm-backdrop" onClick={() => setActiveParcel(null)} role="dialog" aria-modal="true" style={{ zIndex: 99990 }}>
          <div className="adm-modal-sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px', width: '95%' }}>
            <div className="adm-modal-header">
              <div className="adm-modal-header-text">
                <h3 className="adm-modal-title">
                  {activeParcel.consignment_id ? `eShipFirst Parcel #${activeParcel.consignment_id}` : `Order #${activeParcel.order_id}`}
                </h3>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Internal Order Ref: #{activeParcel.order_id} {activeParcel.tracking_code ? `· Tracking: ${activeParcel.tracking_code}` : ''}
                </div>
              </div>
              <button type="button" className="adm-modal-close-btn" onClick={() => setActiveParcel(null)}>✕</button>
            </div>

            <div className="adm-modal-body" style={{ display: 'grid', gap: '14px' }}>
              <div className="adm-modal-info-card">
                <div className="adm-modal-info-heading">Courier &amp; Consignment Information</div>
                <div className="adm-modal-info-row"><span className="lbl">Consignment ID:</span><span className="val bold" style={{ fontFamily: 'monospace', color: '#0369a1' }}>{activeParcel.consignment_id || 'Not Assigned'}</span></div>
                <div className="adm-modal-info-row"><span className="lbl">Tracking Code:</span><span className="val" style={{ fontFamily: 'monospace' }}>{activeParcel.tracking_code || '—'}</span></div>
                <div className="adm-modal-info-row"><span className="lbl">Courier Provider:</span><span className="val">eShipFirst</span></div>
                <div className="adm-modal-info-row"><span className="lbl">Booking Status:</span><span className="val bold">{activeParcel.courier_booking_status || 'booked'}</span></div>
                <div className="adm-modal-info-row"><span className="lbl">Delivery Status:</span><span className="val bold">{getDeliveryStatusInfo(activeParcel.courier_delivery_status).label} ({activeParcel.courier_delivery_status || 'pending'})</span></div>
                {activeParcel.courier_return_status && (
                  <div className="adm-modal-info-row"><span className="lbl">Return Status:</span><span className="val bold">{getReturnStatusInfo(activeParcel.courier_return_status)?.label}</span></div>
                )}
                <div className="adm-modal-info-row"><span className="lbl">Submitted At:</span><span className="val">{activeParcel.courier_submitted_at ? new Date(activeParcel.courier_submitted_at).toLocaleString() : '—'}</span></div>
              </div>

              <div className="adm-modal-info-card">
                <div className="adm-modal-info-heading">Recipient &amp; COD</div>
                <div className="adm-modal-info-row"><span className="lbl">Recipient:</span><span className="val bold">{activeParcel.recipient_name || activeParcel.order?.name}</span></div>
                <div className="adm-modal-info-row"><span className="lbl">Phone:</span><span className="val">{activeParcel.recipient_phone || activeParcel.order?.phone}</span></div>
                <div className="adm-modal-info-row"><span className="lbl">Address:</span><span className="val">{activeParcel.recipient_address || activeParcel.order?.address}</span></div>
                <div className="adm-modal-info-row"><span className="lbl">COD Amount:</span><span className="val bold">৳ {activeParcel.cod_amount ?? activeParcel.order?.total_price ?? 0}</span></div>
              </div>

              <div className="adm-modal-info-card">
                <div className="adm-modal-info-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Live Tracking Response</span>
                  <button
                    type="button"
                    className="adm-btn adm-btn-sm"
                    onClick={() => handleRefreshOne(activeParcel)}
                    disabled={refreshingId === String(activeParcel.order_id)}
                  >
                    <RefreshCw size={13} className={refreshingId === String(activeParcel.order_id) ? 'easy-spinning' : ''} /> Sync Status
                  </button>
                </div>
                {trackingLoading ? (
                  <div style={{ fontSize: '12.5px', color: '#64748b', padding: '10px 0' }}>Fetching live tracking timeline...</div>
                ) : trackingData ? (
                  <pre style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px', borderRadius: '8px', fontSize: '11.5px', overflowX: 'auto', maxHeight: '200px', margin: '8px 0 0' }}>
                    {JSON.stringify(trackingData, null, 2)}
                  </pre>
                ) : (
                  <div style={{ fontSize: '12.5px', color: '#64748b', padding: '8px 0' }}>No remote tracking data available yet.</div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
                {activeParcel.consignment_id && (
                  <button
                    type="button"
                    className="adm-btn"
                    style={{ background: '#0f172a', color: '#fff', borderColor: '#0f172a' }}
                    onClick={() => {
                      handlePrintSingle(activeParcel);
                      setActiveParcel(null);
                    }}
                  >
                    <Printer size={15} /> Print Courier Label
                  </button>
                )}
                <button type="button" className="adm-btn" onClick={() => setActiveParcel(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* THERMAL STICKER PRINT MODAL (SINGLE & BULK LABELS WITH ESHIPFIRST CID) */}
      <ThermalPrintModal
        isOpen={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        orders={ordersToPrint}
        siteSettings={siteSettings}
      />
    </div>
  );
}
