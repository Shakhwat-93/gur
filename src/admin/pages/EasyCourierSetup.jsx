import React, { useState, useEffect } from 'react';
import {
  Truck,
  Save,
  CheckCircle,
  ShieldCheck,
  ShieldAlert,
  Key,
  DollarSign,
  Activity,
  RotateCw,
  ExternalLink,
  Lock,
  AlertTriangle,
  Clock,
  Smartphone,
  Globe,
  Ban,
  Eye,
  Check,
  Undo2
} from 'lucide-react';
import { useCms } from '../../context/CmsContext';

export default function EasyCourierSetup() {
  const { siteSettings, updateSiteSettings, showToast } = useCms();
  const [saving, setSaving] = useState(false);

  // Standard courier provider & delivery charges
  const [courierData, setCourierData] = useState({
    courier_provider: 'steadfast',
    steadfast_api_key: '',
    steadfast_secret_key: '',
    shipping_inside_dhaka: 0,
    shipping_outside_dhaka: 0,
    free_shipping_enabled: true,
    free_shipping_text: 'সারা দেশে ফ্রি হোম ডেলিভারি'
  });

  // BD Courier specific integration state
  const [bdConfig, setBdConfig] = useState({
    is_enabled: false,
    has_key: false,
    masked_key: '',
    connection_status: 'unconfigured',
    connection_message: '',
    last_checked_at: null
  });
  const [bdApiKey, setBdApiKey] = useState('');
  const [bdLoading, setBdLoading] = useState(true);
  const [bdTesting, setBdTesting] = useState(false);
  const [bdSaving, setBdSaving] = useState(false);

  // Duplicate Order Protection State
  const [dupConfig, setDupConfig] = useState({
    is_enabled: true,
    block_same_phone: true,
    block_same_ip: true,
    duration_minutes: 10,
    updated_at: null,
    updated_by: 'admin'
  });
  const [initialDupConfig, setInitialDupConfig] = useState(null);
  const [dupLogs, setDupLogs] = useState([]);
  const [totalBlockedCount, setTotalBlockedCount] = useState(0);
  const [dupLoading, setDupLoading] = useState(true);
  const [dupSaving, setDupSaving] = useState(false);
  const [showLogsTable, setShowLogsTable] = useState(true);

  // Fetch Duplicate Protection server-side configuration
  const fetchDupConfig = async () => {
    try {
      setDupLoading(true);
      const res = await fetch(`/api/admin-duplicate-config?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      const data = await res.json();
      if (data?.config) {
        const rawMins =
          data.config.duration_minutes ??
          data.config.phone_window_minutes ??
          data.config.ip_window_minutes;
        const duration = parseInt(rawMins, 10);
        const validDuration = isNaN(duration) || duration <= 0 ? 10 : duration;

        const normalized = {
          ...data.config,
          is_enabled: data.config.is_enabled !== false,
          block_same_phone: data.config.block_same_phone !== false,
          block_same_ip: data.config.block_same_ip !== false,
          duration_minutes: validDuration
        };

        setDupConfig(normalized);
        setInitialDupConfig(normalized);
        setTotalBlockedCount(data.totalBlocked || 0);
        setDupLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Error fetching duplicate protection settings:', err);
    } finally {
      setDupLoading(false);
    }
  };

  // Fetch BD Courier server-side configuration
  const fetchBdConfig = async () => {
    try {
      setBdLoading(true);
      const res = await fetch('/api/admin-courier-config');
      const data = await res.json();
      if (data?.config) {
        setBdConfig(data.config);
      }
    } catch (err) {
      console.error('Error fetching BD Courier settings:', err);
    } finally {
      setBdLoading(false);
    }
  };

  useEffect(() => {
    if (siteSettings) {
      setCourierData({
        courier_provider: siteSettings.courier_provider || 'steadfast',
        steadfast_api_key: siteSettings.steadfast_api_key || '',
        steadfast_secret_key: siteSettings.steadfast_secret_key || '',
        shipping_inside_dhaka: siteSettings.shipping_inside_dhaka ?? 0,
        shipping_outside_dhaka: siteSettings.shipping_outside_dhaka ?? 0,
        free_shipping_enabled: siteSettings.free_shipping_enabled !== false,
        free_shipping_text: siteSettings.free_shipping_text || 'সারা দেশে ফ্রি হোম ডেলিভারি'
      });
    }
    fetchBdConfig();
    fetchDupConfig();
  }, [siteSettings]);

  // Save standard shipping settings
  const handleSaveStandard = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSiteSettings({
        courier_provider: courierData.courier_provider,
        steadfast_api_key: courierData.steadfast_api_key.trim(),
        steadfast_secret_key: courierData.steadfast_secret_key.trim(),
        shipping_inside_dhaka: parseFloat(courierData.shipping_inside_dhaka) || 0,
        shipping_outside_dhaka: parseFloat(courierData.shipping_outside_dhaka) || 0,
        free_shipping_enabled: courierData.free_shipping_enabled,
        free_shipping_text: courierData.free_shipping_text
      });
      showToast('Courier & delivery settings saved successfully!');
    } catch (err) {
      console.error(err);
      showToast('Failed to save courier settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Save BD Courier Integration settings
  const handleSaveBdCourier = async () => {
    setBdSaving(true);
    try {
      const res = await fetch('/api/admin-courier-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_enabled: bdConfig.is_enabled,
          api_key: bdApiKey.trim() || undefined
        })
      });
      const data = await res.json();
      if (data?.success && data?.config) {
        setBdConfig(data.config);
        setBdApiKey('');
        showToast('BD Courier integration settings saved successfully!');
      } else {
        throw new Error(data?.error || 'Failed to save');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to save BD Courier settings', 'error');
    } finally {
      setBdSaving(false);
    }
  };

  // Test connection to BD Courier API
  const handleTestConnection = async () => {
    setBdTesting(true);
    try {
      const res = await fetch('/api/admin-courier-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          api_key: bdApiKey.trim() || undefined
        })
      });
      const data = await res.json();
      if (data?.connected) {
        showToast('✓ BD Courier API connected successfully!');
      } else {
        showToast(`⚠️ Connection failed: ${data?.message || 'Invalid Key'}`, 'error');
      }
      // Refresh current config status
      await fetchBdConfig();
    } catch (err) {
      console.error(err);
      showToast('Network error during connection test', 'error');
    } finally {
      setBdTesting(false);
    }
  };

  // Save Duplicate Protection Configuration
  const handleSaveDuplicateConfig = async () => {
    const mins = parseInt(dupConfig.duration_minutes, 10);
    if (isNaN(mins) || mins < 1 || mins > 1440) {
      showToast('Duration must be between 1 and 1440 minutes (24 hours)', 'error');
      return;
    }

    setDupSaving(true);
    try {
      const payload = {
        ...dupConfig,
        duration_minutes: mins,
        phone_window_minutes: mins,
        ip_window_minutes: mins
      };

      const res = await fetch(`/api/admin-duplicate-config?_t=${Date.now()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data?.success && data?.config) {
        const savedDuration = parseInt(
          data.config.duration_minutes ?? data.config.phone_window_minutes ?? mins,
          10
        );
        const normalized = {
          ...data.config,
          duration_minutes: savedDuration
        };
        setDupConfig(normalized);
        setInitialDupConfig(normalized);
        showToast('Duplicate order protection settings saved successfully!');
        await fetchDupConfig();
      } else {
        throw new Error(data?.error || 'Failed to save');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to save protection settings: ' + err.message, 'error');
    } finally {
      setDupSaving(false);
    }
  };

  const handleResetDuplicateConfig = () => {
    if (initialDupConfig) {
      setDupConfig(initialDupConfig);
      showToast('Reverted to saved settings');
    }
  };

  const getHumanDuration = (mins) => {
    const m = parseInt(mins, 10) || 0;
    if (m <= 0) return '10 min';
    if (m < 60) return `${m} min`;
    const hours = Math.floor(m / 60);
    const remMins = m % 60;
    if (remMins === 0) return `${hours} hr`;
    return `${hours} hr ${remMins} min`;
  };

  const getStatusBadge = () => {
    switch (bdConfig.connection_status) {
      case 'connected':
        return (
          <span className="adm-badge adm-badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle size={12} /> Connected (Active)
          </span>
        );
      case 'invalid_key':
        return (
          <span className="adm-badge adm-badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <AlertTriangle size={12} /> Invalid API Key
          </span>
        );
      case 'unverified':
        return (
          <span className="adm-badge adm-badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Activity size={12} /> Key Updated — Test Needed
          </span>
        );
      case 'error':
        return (
          <span className="adm-badge adm-badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <AlertTriangle size={12} /> Connection Error
          </span>
        );
      default:
        return (
          <span className="adm-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', color: '#64748b' }}>
            ○ Not Configured
          </span>
        );
    }
  };

  return (
    <div className="easy-page-wrap">
      <div className="easy-card-header">
        <h2 className="easy-page-title">Fraud Protection & Courier Setup</h2>
        <p className="easy-page-desc">
          Configure anti-duplicate spam order protection, courier integrations, and customer delivery verification.
        </p>
      </div>

      <div className="easy-form-stack">
        {/* ================================================================= */}
        {/* SECTION: Fraud Protection → Duplicate Order Protection             */}
        {/* ================================================================= */}
        <div className="easy-subcard" style={{ border: '2px solid #fed7aa', background: '#fffcf9' }}>
          <div className="easy-section-head" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldAlert size={20} color="#ffffff" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: 700, color: '#9a3412' }}>
                  Duplicate Order Protection (Fraud Blocker)
                </h3>
                <p style={{ margin: '3px 0 0 0', fontSize: '12.5px', color: '#7c2d12' }}>
                  Prevent fake and accidental repeated orders from the same phone number or IP address.
                </p>
              </div>
            </div>

            {/* Active Status Badge */}
            <div>
              {dupConfig.is_enabled ? (
                <span className="adm-badge adm-badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <CheckCircle size={13} /> Active ({getHumanDuration(dupConfig.duration_minutes)})
                </span>
              ) : (
                <span className="adm-badge adm-badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Ban size={13} /> Disabled
                </span>
              )}
            </div>
          </div>

          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #fed7aa' }}>
            {/* Main Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', background: '#ffffff', padding: '14px 16px', borderRadius: '12px', border: '1px solid #fed7aa' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b' }}>
                  Enable Duplicate Order Protection
                </div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                  Repeated submissions from the same phone number or IP address will be blocked within the configured time window.
                </div>
              </div>
              <label className="easy-switch">
                <input
                  type="checkbox"
                  checked={dupConfig.is_enabled}
                  onChange={(e) => setDupConfig({ ...dupConfig, is_enabled: e.target.checked })}
                />
                <span className="easy-slider round"></span>
              </label>
            </div>

            {/* Dual Toggles Grid: Phone & IP (OR Logic) */}
            <div className="adm-grid-2" style={{ marginBottom: '18px' }}>
              {/* Phone Protection Toggle */}
              <div style={{ background: '#ffffff', border: dupConfig.block_same_phone ? '1.5px solid #ea580c' : '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px', transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#1e293b' }}>
                    <Smartphone size={17} color={dupConfig.block_same_phone ? '#ea580c' : '#64748b'} />
                    <span>Block Repeated Phone Numbers</span>
                  </div>
                  <label className="easy-switch">
                    <input
                      type="checkbox"
                      checked={dupConfig.block_same_phone}
                      onChange={(e) => setDupConfig({ ...dupConfig, block_same_phone: e.target.checked })}
                    />
                    <span className="easy-slider round"></span>
                  </label>
                </div>
                <div style={{ fontSize: '12.5px', color: '#64748b', lineHeight: '1.45' }}>
                  Normalizes phone numbers across all formats (01..., +8801..., Bengali digits) and checks against recent orders.
                </div>
              </div>

              {/* IP Protection Toggle */}
              <div style={{ background: '#ffffff', border: dupConfig.block_same_ip ? '1.5px solid #ea580c' : '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px', transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#1e293b' }}>
                    <Globe size={17} color={dupConfig.block_same_ip ? '#ea580c' : '#64748b'} />
                    <span>Block Repeated IP Addresses</span>
                  </div>
                  <label className="easy-switch">
                    <input
                      type="checkbox"
                      checked={dupConfig.block_same_ip}
                      onChange={(e) => setDupConfig({ ...dupConfig, block_same_ip: e.target.checked })}
                    />
                    <span className="easy-slider round"></span>
                  </label>
                </div>
                <div style={{ fontSize: '12.5px', color: '#64748b', lineHeight: '1.45' }}>
                  Detects and blocks rapid submissions from the same IP network even if different names or numbers are entered.
                </div>
              </div>
            </div>

            {/* OR Logic Explanation Notice */}
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 14px', marginBottom: '18px', fontSize: '12.5px', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} color="#2563eb" />
              <span>
                <strong>Protection Logic:</strong> Within the configured time window, a submission is blocked if either the customer phone number or IP address matches a recent order.
              </span>
            </div>

            {/* Configurable Duration Section */}
            <div style={{ background: '#ffffff', border: '1px solid #fed7aa', borderRadius: '12px', padding: '16px', marginBottom: '18px' }}>
              <label style={{ display: 'block', fontWeight: 700, color: '#1e293b', marginBottom: '6px' }}>
                Cooldown Window Duration
              </label>
              <div style={{ fontSize: '12.5px', color: '#64748b', marginBottom: '12px' }}>
                Window Preview: After placing an order, customers cannot re-submit another order for <strong>{getHumanDuration(dupConfig.duration_minutes)}</strong>.
              </div>

              {/* Number Input + Unit */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', maxWidth: '300px', marginBottom: '12px' }}>
                <input
                  type="number"
                  className="easy-input"
                  min="1"
                  max="1440"
                  value={dupConfig.duration_minutes}
                  onChange={(e) => setDupConfig({ ...dupConfig, duration_minutes: e.target.value })}
                  style={{ fontWeight: 700, fontSize: '15px' }}
                />
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
                  Minutes
                </span>
              </div>

              {/* Quick Select Buttons */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { label: '5 Mins', val: 5 },
                  { label: '10 Mins (Default)', val: 10 },
                  { label: '30 Mins', val: 30 },
                  { label: '1 Hour', val: 60 },
                  { label: '24 Hours', val: 1440 }
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    onClick={() => setDupConfig({ ...dupConfig, duration_minutes: item.val })}
                    className="adm-btn adm-btn-sm"
                    style={{
                      background: Number(dupConfig.duration_minutes) === item.val ? '#ea580c' : '#f8fafc',
                      color: Number(dupConfig.duration_minutes) === item.val ? '#ffffff' : '#374151',
                      borderColor: Number(dupConfig.duration_minutes) === item.val ? '#ea580c' : '#e2e8f0',
                      fontWeight: 600
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons & Audit */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="adm-btn adm-btn-primary"
                  style={{ background: '#ea580c', borderColor: '#ea580c' }}
                  onClick={handleSaveDuplicateConfig}
                  disabled={dupSaving}
                >
                  <Save size={15} />
                  <span>{dupSaving ? 'Saving...' : 'Save Protection Settings'}</span>
                </button>

                <button
                  type="button"
                  className="adm-btn"
                  style={{ background: '#ffffff', borderColor: '#e2e8f0', color: '#475569' }}
                  onClick={handleResetDuplicateConfig}
                >
                  <Undo2 size={15} />
                  <span>Cancel / Reset</span>
                </button>
              </div>

              {dupConfig.updated_at && (
                <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                  Last updated: {new Date(dupConfig.updated_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })} • Admin: {dupConfig.updated_by}
                </div>
              )}
            </div>

            {/* Blocked Attempt Logs Card */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={17} color="#dc2626" />
                  <strong style={{ fontSize: '14px', color: '#1e293b' }}>
                    Recent Blocked Duplicate Orders
                  </strong>
                  <span className="adm-badge adm-badge-danger" style={{ fontWeight: 700 }}>
                    Total Blocked: {totalBlockedCount}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="adm-btn adm-btn-sm"
                    style={{ background: '#f8fafc', borderColor: '#e2e8f0', color: '#475569' }}
                    onClick={fetchDupConfig}
                    title="Refresh logs"
                  >
                    <RotateCw size={13} className={dupLoading ? 'easy-spinning' : ''} />
                    <span>Refresh</span>
                  </button>

                  <button
                    type="button"
                    className="adm-btn adm-btn-sm"
                    style={{ background: '#f8fafc', borderColor: '#e2e8f0', color: '#475569' }}
                    onClick={() => setShowLogsTable(!showLogsTable)}
                  >
                    {showLogsTable ? 'Hide Logs' : 'View Logs'}
                  </button>
                </div>
              </div>

              {showLogsTable && (
                dupLogs.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                    ✓ No blocked duplicate order attempts recorded.
                  </div>
                ) : (
                  <div className="adm-table-wrap">
                    <table className="easy-table" style={{ minWidth: '700px' }}>
                      <thead>
                        <tr>
                          <th>Date & Time</th>
                          <th>Phone Number</th>
                          <th>IP Address</th>
                          <th>Reason</th>
                          <th>Matched Order</th>
                          <th>Cooldown Remaining</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dupLogs.map((log) => (
                          <tr key={log.id}>
                            <td style={{ fontSize: '12px', color: '#475569', whiteSpace: 'nowrap' }}>
                              {new Date(log.created_at).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                              {log.phone_masked || log.phone}
                            </td>
                            <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#64748b' }}>
                              {log.ip_masked || log.ip_address}
                            </td>
                            <td>
                              {log.blocked_reason === 'both' ? (
                                <span className="adm-badge adm-badge-danger">Phone & IP</span>
                              ) : log.blocked_reason === 'same_phone' ? (
                                <span className="adm-badge adm-badge-warning">Phone Matched</span>
                              ) : (
                                <span className="adm-badge adm-badge-info">IP Matched</span>
                              )}
                            </td>
                            <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#0369a1' }}>
                              #{log.matching_order_id}
                            </td>
                            <td style={{ fontSize: '12px', color: '#b91c1c', fontWeight: 600 }}>
                              {log.cooldown_remaining_seconds ? `~${Math.ceil(log.cooldown_remaining_seconds / 60)} min` : 'Active'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* SECTION: BD Courier Official API Integration                      */}
        {/* ================================================================= */}
        <div className="easy-subcard" style={{ border: '2px solid #fed7aa', background: '#fffaf5' }}>
          <div className="easy-section-head" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={18} color="#ffffff" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#9a3412' }}>
                  BD Courier Integration (Delivery Ratio & Fraud Check)
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#7c2d12' }}>
                  Official API to check customer delivery success rate and past courier returns.
                </p>
              </div>
            </div>

            {/* Connection Status Badge */}
            <div>{getStatusBadge()}</div>
          </div>

          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #fed7aa' }}>
            {/* Toggle Enable/Disable */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#1e293b' }}>
                  Enable BD Courier Verification
                </div>
                <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                  Automatically retrieves customer courier statistics on new orders and caches them permanently in Supabase.
                </div>
              </div>
              <label className="easy-switch">
                <input
                  type="checkbox"
                  checked={bdConfig.is_enabled}
                  onChange={(e) => setBdConfig({ ...bdConfig, is_enabled: e.target.checked })}
                />
                <span className="easy-slider round"></span>
              </label>
            </div>

            {/* At-most-once Guarantee Banner */}
            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontSize: '12.5px', color: '#065f46', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={16} color="#059669" />
              <span>
                <strong>At-Most-Once Guarantee Active:</strong> External API calls are never duplicated for the same phone number. Page refreshes and repeat orders reuse cached database records.
              </span>
            </div>

            {/* API Key Input Form */}
            <form onSubmit={(e) => { e.preventDefault(); handleSaveBdCourier(); }}>
              <div className="easy-field-group">
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>BD Courier API Key (Bearer Token)</span>
                  {bdConfig.has_key && (
                    <span style={{ fontSize: '11px', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Lock size={11} /> AES-256 Encrypted: <code>{bdConfig.masked_key}</code>
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  className="easy-input"
                  value={bdApiKey}
                  onChange={(e) => setBdApiKey(e.target.value)}
                  placeholder={bdConfig.has_key ? 'Leave blank to keep existing key' : 'Paste your BD Courier API Bearer Token'}
                />
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Login to your BD Courier account to obtain your API key.</span>
                  <a
                    href="https://bdcourier.com"
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#ea580c', display: 'inline-flex', alignItems: 'center', gap: '3px', textDecoration: 'none', fontWeight: 600 }}
                  >
                    bdcourier.com <ExternalLink size={11} />
                  </a>
                </div>
              </div>

              {/* Status Message Info */}
              {bdConfig.connection_message && (
                <div style={{ fontSize: '12px', color: bdConfig.connection_status === 'connected' ? '#059669' : '#b91c1c', marginBottom: '16px', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <strong>Status Message:</strong> {bdConfig.connection_message}
                  {bdConfig.last_checked_at && (
                    <span style={{ marginLeft: '10px', color: '#64748b' }}>
                      (Last verified: {new Date(bdConfig.last_checked_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })})
                    </span>
                  )}
                </div>
              )}

              {/* Action Buttons Row */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="adm-btn"
                  style={{ background: '#ffffff', borderColor: '#fed7aa', color: '#c2410c', fontWeight: 600 }}
                  onClick={handleTestConnection}
                  disabled={bdTesting || (!bdConfig.has_key && !bdApiKey)}
                >
                  <RotateCw size={14} className={bdTesting ? 'easy-spinning' : ''} />
                  <span>{bdTesting ? 'Testing...' : 'Test Connection'}</span>
                </button>

                <button
                  type="submit"
                  className="adm-btn adm-btn-primary"
                  style={{ background: '#ea580c', borderColor: '#ea580c' }}
                  disabled={bdSaving}
                >
                  <Save size={14} />
                  <span>{bdSaving ? 'Saving...' : 'Save Courier Settings'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ================================================================= */}
        {/* SECTION: Standard Courier Partner & Delivery Fee                  */}
        {/* ================================================================= */}
        <form onSubmit={handleSaveStandard} className="easy-form-stack">
          {/* Courier Provider Selection */}
          <div className="easy-subcard">
            <div className="easy-section-head">
              <Truck size={18} className="text-orange" />
              <h3>Parcel Courier Partner</h3>
            </div>

            <div className="easy-radio-grid">
              <label className={`easy-radio-card ${courierData.courier_provider === 'steadfast' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="courier_provider"
                  value="steadfast"
                  checked={courierData.courier_provider === 'steadfast'}
                  onChange={() => setCourierData({ ...courierData, courier_provider: 'steadfast' })}
                />
                <div className="easy-radio-content">
                  <div style={{ fontWeight: 700 }}>Steadfast Courier</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Direct API Integration (Recommended)</div>
                </div>
              </label>

              <label className={`easy-radio-card ${courierData.courier_provider === 'pathao' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="courier_provider"
                  value="pathao"
                  checked={courierData.courier_provider === 'pathao'}
                  onChange={() => setCourierData({ ...courierData, courier_provider: 'pathao' })}
                />
                <div className="easy-radio-content">
                  <div style={{ fontWeight: 700 }}>Pathao Courier</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Pathao Merchant Logistics</div>
                </div>
              </label>

              <label className={`easy-radio-card ${courierData.courier_provider === 'redx' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="courier_provider"
                  value="redx"
                  checked={courierData.courier_provider === 'redx'}
                  onChange={() => setCourierData({ ...courierData, courier_provider: 'redx' })}
                />
                <div className="easy-radio-content">
                  <div style={{ fontWeight: 700 }}>RedX Delivery</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>RedX Logistics</div>
                </div>
              </label>

              <label className={`easy-radio-card ${courierData.courier_provider === 'manual' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="courier_provider"
                  value="manual"
                  checked={courierData.courier_provider === 'manual'}
                  onChange={() => setCourierData({ ...courierData, courier_provider: 'manual' })}
                />
                <div className="easy-radio-content">
                  <div style={{ fontWeight: 700 }}>Manual Courier</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Manual Parcel Booking</div>
                </div>
              </label>
            </div>
          </div>

          {/* Steadfast API Credentials */}
          {courierData.courier_provider === 'steadfast' && (
            <div className="easy-subcard">
              <div className="easy-section-head">
                <Key size={18} className="text-orange" />
                <h3>Steadfast API Credentials</h3>
              </div>

              <div className="easy-field-group">
                <label>Steadfast API Key</label>
                <input
                  type="text"
                  className="easy-input"
                  value={courierData.steadfast_api_key}
                  onChange={(e) => setCourierData({ ...courierData, steadfast_api_key: e.target.value })}
                  placeholder="Paste your Steadfast API Key"
                />
              </div>

              <div className="easy-field-group">
                <label>Steadfast Secret Key</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  className="easy-input"
                  value={courierData.steadfast_secret_key}
                  onChange={(e) => setCourierData({ ...courierData, steadfast_secret_key: e.target.value })}
                  placeholder="Paste your Steadfast Secret Key"
                />
              </div>
            </div>
          )}

          {/* Delivery Charges */}
          <div className="easy-subcard">
            <div className="easy-section-head">
              <DollarSign size={18} className="text-orange" />
              <h3>Delivery Fee Configuration</h3>
            </div>

            <div style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 600 }}>Free Nationwide Delivery</div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>When enabled, customers receive free shipping on all orders</div>
              </div>
              <label className="easy-switch">
                <input
                  type="checkbox"
                  checked={courierData.free_shipping_enabled}
                  onChange={(e) => setCourierData({ ...courierData, free_shipping_enabled: e.target.checked })}
                />
                <span className="easy-slider round"></span>
              </label>
            </div>

            {!courierData.free_shipping_enabled && (
              <div className="easy-two-col">
                <div className="easy-field-group">
                  <label>Inside Dhaka (৳)</label>
                  <input
                    type="number"
                    className="easy-input"
                    value={courierData.shipping_inside_dhaka}
                    onChange={(e) => setCourierData({ ...courierData, shipping_inside_dhaka: e.target.value })}
                  />
                </div>
                <div className="easy-field-group">
                  <label>Outside Dhaka (৳)</label>
                  <input
                    type="number"
                    className="easy-input"
                    value={courierData.shipping_outside_dhaka}
                    onChange={(e) => setCourierData({ ...courierData, shipping_outside_dhaka: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="easy-submit-wrap">
            <button type="submit" className="easy-save-btn" disabled={saving}>
              <Save size={18} />
              <span>{saving ? 'Saving...' : 'Save Delivery Settings'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
