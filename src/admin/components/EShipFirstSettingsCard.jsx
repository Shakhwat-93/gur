import React, { useState, useEffect } from 'react';
import {
  Truck,
  Key,
  Lock,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Activity,
  RotateCw,
  Save,
  Unplug,
  Copy,
  Check,
  Wallet,
  Webhook,
  Zap,
  MapPin,
  DollarSign
} from 'lucide-react';
import {
  fetchEShipFirstConfig,
  saveEShipFirstConfig,
  testEShipFirstConnection,
  disconnectEShipFirst
} from '../lib/eshipfirstClient';

const DEFAULT_BASE_URL = 'https://portal.packzy.com/api/v1';

export default function EShipFirstSettingsCard({ showToast, onOpenCourierDashboard }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const [config, setConfig] = useState({
    is_enabled: false,
    auto_submit_on_confirm: true,
    base_url: DEFAULT_BASE_URL,
    has_api_key: false,
    has_secret_key: false,
    masked_api_key: '',
    masked_secret_key: '',
    has_webhook_token: false,
    masked_webhook_token: '',
    default_delivery_charge: '',
    default_pickup_address: '',
    connection_status: 'unconfigured',
    connection_message: 'Not configured yet',
    last_checked_at: null,
    current_balance: null
  });

  // Plaintext inputs — cleared immediately after save (server never returns raw secrets)
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [secretKeyInput, setSecretKeyInput] = useState('');
  const [webhookTokenInput, setWebhookTokenInput] = useState('');
  const [inlineFeedback, setInlineFeedback] = useState(null);

  const webhookUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/api/eshipfirst-webhook` : '/api/eshipfirst-webhook';

  const loadConfig = async () => {
    try {
      setLoading(true);
      const { ok, data } = await fetchEShipFirstConfig();
      if (ok && data?.config) {
        setConfig((prev) => ({
          ...prev,
          ...data.config,
          base_url: data.config.base_url || DEFAULT_BASE_URL
        }));
      }
    } catch (err) {
      console.error('[EShipFirstSettingsCard] load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSave = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    setInlineFeedback(null);
    try {
      const { ok, data } = await saveEShipFirstConfig({
        is_enabled: config.is_enabled,
        auto_submit_on_confirm: config.auto_submit_on_confirm,
        base_url: (config.base_url || DEFAULT_BASE_URL).trim(),
        api_key: apiKeyInput.trim() || undefined,
        secret_key: secretKeyInput.trim() || undefined,
        webhook_token: webhookTokenInput.trim() || undefined,
        default_delivery_charge: config.default_delivery_charge,
        default_pickup_address: config.default_pickup_address
      });

      if (!ok || !data?.success) {
        const errMsg = data?.error || 'Failed to save eShipFirst configuration.';
        setInlineFeedback({ type: 'error', text: errMsg });
        showToast?.(errMsg, 'error');
        return;
      }

      if (data.config) {
        setConfig(data.config);
      }
      setApiKeyInput('');
      setSecretKeyInput('');
      setWebhookTokenInput('');

      const test = data.connection_test;
      if (test) {
        if (test.connected) {
          setInlineFeedback({ type: 'success', text: test.message });
          showToast?.('✓ eShipFirst configuration saved & connected!');
        } else {
          setInlineFeedback({ type: 'error', text: `Saved, but connection failed: ${test.message}` });
          showToast?.(`Connection Failed: ${test.message}`, 'error');
        }
      } else {
        setInlineFeedback({ type: 'info', text: data.message || 'Configuration saved.' });
        showToast?.('eShipFirst settings saved.');
      }
    } catch (err) {
      const msg = err.message || 'Network error saving configuration.';
      setInlineFeedback({ type: 'error', text: msg });
      showToast?.(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setInlineFeedback(null);
    try {
      const { ok, data } = await testEShipFirstConnection({
        api_key: apiKeyInput.trim() || undefined,
        secret_key: secretKeyInput.trim() || undefined,
        base_url: (config.base_url || DEFAULT_BASE_URL).trim()
      });

      if (data?.config) {
        setConfig(data.config);
      }

      if (ok && data?.connected) {
        setInlineFeedback({ type: 'success', text: data.message || 'Connected to eShipFirst API!' });
        showToast?.('✓ Connected to eShipFirst API!');
      } else {
        const msg = data?.message || data?.error || 'Connection test failed.';
        setInlineFeedback({ type: 'error', text: msg });
        showToast?.(`⚠️ ${msg}`, 'error');
      }
    } catch (err) {
      const msg = err.message || 'Network error testing API connection.';
      setInlineFeedback({ type: 'error', text: msg });
      showToast?.(msg, 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect eShipFirst integration and remove stored API credentials?')) {
      return;
    }
    setDisconnecting(true);
    setInlineFeedback(null);
    try {
      const { ok, data } = await disconnectEShipFirst();
      if (ok && data?.config) {
        setConfig(data.config);
        setApiKeyInput('');
        setSecretKeyInput('');
        setInlineFeedback({ type: 'info', text: 'eShipFirst disconnected and credentials removed.' });
        showToast?.('eShipFirst disconnected successfully.');
      } else {
        throw new Error(data?.error || 'Failed to disconnect.');
      }
    } catch (err) {
      showToast?.(err.message || 'Disconnect failed', 'error');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleCopyWebhook = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(webhookUrl);
    }
    setCopiedWebhook(true);
    showToast?.('Webhook URL copied to clipboard');
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const renderConnectionBadge = () => {
    switch (config.connection_status) {
      case 'connected':
        return (
          <span className="adm-badge adm-badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px' }}>
            <CheckCircle2 size={13} /> Connected
          </span>
        );
      case 'failed':
        return (
          <span className="adm-badge adm-badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px' }}>
            <AlertTriangle size={13} /> Connection Failed
          </span>
        );
      case 'disconnected':
        return (
          <span className="adm-badge" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px' }}>
            <Unplug size={13} /> Disconnected
          </span>
        );
      default:
        return (
          <span className="adm-badge" style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px' }}>
            <Activity size={13} /> Not Configured
          </span>
        );
    }
  };

  return (
    <div
      className="adm-card"
      style={{
        marginBottom: '24px',
        border: '1.5px solid #0ea5e9',
        boxShadow: '0 4px 18px rgba(14, 165, 233, 0.08)'
      }}
    >
      <div
        className="adm-card-header"
        style={{
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
          borderBottom: '1px solid #bae6fd',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: '#0284c7',
              color: '#ffffff',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0
            }}
          >
            <Truck size={20} />
          </div>
          <div>
            <h3 className="adm-card-title" style={{ margin: 0, color: '#0c4a6e' }}>
              eShipFirst Courier API Integration
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#0369a1' }}>
              Automated Parcel Booking, Consignment Sync, Live Tracking &amp; Thermal Label Printing
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {config.current_balance !== null && config.connection_status === 'connected' && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: '#ffffff',
                border: '1px solid #bae6fd',
                color: '#0369a1',
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '12.5px',
                fontWeight: 800
              }}
            >
              <Wallet size={13} /> Balance: ৳{Number(config.current_balance).toLocaleString('en-IN')}
            </span>
          )}
          {renderConnectionBadge()}
          {onOpenCourierDashboard && (
            <button
              type="button"
              className="adm-btn adm-btn-sm"
              onClick={onOpenCourierDashboard}
              style={{ background: '#0f172a', color: '#ffffff', borderColor: '#0f172a', fontWeight: 700 }}
            >
              Open Courier Dashboard →
            </button>
          )}
        </div>
      </div>

      <div className="adm-card-body">
        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13.5px' }}>
            Loading encrypted eShipFirst settings...
          </div>
        ) : (
          <form onSubmit={handleSave}>
            {/* Inline Status / Feedback Alert */}
            {(inlineFeedback || config.connection_message) && (
              <div
                style={{
                  padding: '11px 14px',
                  borderRadius: '10px',
                  marginBottom: '16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                  background:
                    (inlineFeedback?.type || (config.connection_status === 'connected' ? 'success' : config.connection_status === 'failed' ? 'error' : 'info')) === 'success'
                      ? '#ecfdf5'
                      : (inlineFeedback?.type || (config.connection_status === 'failed' ? 'error' : 'info')) === 'error'
                      ? '#fef2f2'
                      : '#f8fafc',
                  border:
                    (inlineFeedback?.type || (config.connection_status === 'connected' ? 'success' : config.connection_status === 'failed' ? 'error' : 'info')) === 'success'
                      ? '1px solid #a7f3d0'
                      : (inlineFeedback?.type || (config.connection_status === 'failed' ? 'error' : 'info')) === 'error'
                      ? '1px solid #fecaca'
                      : '1px solid #e2e8f0',
                  color:
                    (inlineFeedback?.type || (config.connection_status === 'connected' ? 'success' : config.connection_status === 'failed' ? 'error' : 'info')) === 'success'
                      ? '#065f46'
                      : (inlineFeedback?.type || (config.connection_status === 'failed' ? 'error' : 'info')) === 'error'
                      ? '#991b1b'
                      : '#334155'
                }}
              >
                <span>{inlineFeedback?.text || config.connection_message}</span>
                {config.last_checked_at && (
                  <span style={{ fontSize: '11.5px', opacity: 0.8 }}>
                    Last checked: {new Date(config.last_checked_at).toLocaleString()}
                  </span>
                )}
              </div>
            )}

            {/* Toggle Row: Enable Integration + Automatic Submission */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '12px',
                marginBottom: '18px'
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: config.is_enabled ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                  background: config.is_enabled ? '#f0f9ff' : '#f8fafc',
                  cursor: 'pointer'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#0f172a' }}>
                    Enable eShipFirst Integration
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Activate live parcel creation, tracking &amp; courier dashboard
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.is_enabled}
                  onChange={(e) => setConfig((prev) => ({ ...prev, is_enabled: e.target.checked }))}
                  style={{ width: '18px', height: '18px', accentColor: '#0284c7', cursor: 'pointer' }}
                />
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: config.auto_submit_on_confirm ? '1.5px solid #059669' : '1px solid #e2e8f0',
                  background: config.auto_submit_on_confirm ? '#ecfdf5' : '#f8fafc',
                  cursor: 'pointer'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Zap size={14} color="#059669" /> Automatic Order Submission
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Automatically book parcel when an admin confirms an order
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={config.auto_submit_on_confirm}
                  onChange={(e) => setConfig((prev) => ({ ...prev, auto_submit_on_confirm: e.target.checked }))}
                  style={{ width: '18px', height: '18px', accentColor: '#059669', cursor: 'pointer' }}
                />
              </label>
            </div>

            {/* Credentials & Base URL */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '14px',
                marginBottom: '16px'
              }}
            >
              <div>
                <label className="adm-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Key size={14} /> API Key
                  {config.has_api_key && (
                    <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700, marginLeft: 'auto' }}>
                      Stored: {config.masked_api_key}
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  className="adm-input"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={config.has_api_key ? 'Leave blank to keep encrypted API Key' : 'Enter eShipFirst Api-Key'}
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label className="adm-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Lock size={14} /> Secret Key
                  {config.has_secret_key && (
                    <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700, marginLeft: 'auto' }}>
                      Stored: {config.masked_secret_key}
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  className="adm-input"
                  value={secretKeyInput}
                  onChange={(e) => setSecretKeyInput(e.target.value)}
                  placeholder={config.has_secret_key ? 'Leave blank to keep encrypted Secret Key' : 'Enter eShipFirst Secret-Key'}
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label className="adm-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Globe size={14} /> API Base URL
                </label>
                <input
                  type="url"
                  className="adm-input"
                  value={config.base_url}
                  onChange={(e) => setConfig((prev) => ({ ...prev, base_url: e.target.value }))}
                  placeholder={DEFAULT_BASE_URL}
                  required
                />
              </div>
            </div>

            {/* Optional Defaults: Delivery Charge & Pickup Address */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '14px',
                marginBottom: '16px'
              }}
            >
              <div>
                <label className="adm-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <DollarSign size={14} /> Default Delivery Charge (Optional)
                </label>
                <input
                  type="number"
                  min="0"
                  className="adm-input"
                  value={config.default_delivery_charge}
                  onChange={(e) => setConfig((prev) => ({ ...prev, default_delivery_charge: e.target.value }))}
                  placeholder="e.g. 100 (৳)"
                />
              </div>

              <div>
                <label className="adm-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={14} /> Default Pickup Address (Optional)
                </label>
                <input
                  type="text"
                  className="adm-input"
                  value={config.default_pickup_address}
                  onChange={(e) => setConfig((prev) => ({ ...prev, default_pickup_address: e.target.value }))}
                  placeholder="Warehouse / pickup street address for rider pickup requests"
                />
              </div>
            </div>

            {/* Webhook Receiver Configuration */}
            <div
              style={{
                padding: '12px 14px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                marginBottom: '18px'
              }}
            >
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Webhook size={14} color="#0284c7" /> Real-Time Status Webhook (Optional — Bearer Token Auth)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Callback URL (Paste in eShipFirst Merchant Portal)
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      readOnly
                      className="adm-input"
                      value={webhookUrl}
                      style={{ fontSize: '12px', fontFamily: 'monospace', background: '#ffffff' }}
                    />
                    <button type="button" className="adm-btn adm-btn-sm" onClick={handleCopyWebhook} title="Copy webhook URL">
                      {copiedWebhook ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Webhook Bearer Token {config.has_webhook_token && <span style={{ color: '#059669' }}>(Configured: {config.masked_webhook_token})</span>}
                  </label>
                  <input
                    type="password"
                    className="adm-input"
                    value={webhookTokenInput}
                    onChange={(e) => setWebhookTokenInput(e.target.value)}
                    placeholder={config.has_webhook_token ? 'Leave blank to keep stored Bearer token' : 'Enter matching Bearer token'}
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons: Save Configuration, Test API Connection, Disconnect */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="submit"
                  className="adm-btn adm-btn-primary"
                  disabled={saving || testing}
                  style={{
                    background: '#0284c7',
                    borderColor: '#0284c7',
                    color: '#ffffff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    fontWeight: 700,
                    padding: '9px 18px'
                  }}
                >
                  {saving ? <RotateCw size={15} className="easy-spinning" /> : <Save size={15} />}
                  <span>{saving ? 'Validating & Saving...' : 'Save Configuration'}</span>
                </button>

                <button
                  type="button"
                  className="adm-btn"
                  disabled={testing || saving}
                  onClick={handleTest}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    fontWeight: 700,
                    padding: '9px 16px'
                  }}
                >
                  <RotateCw size={15} className={testing ? 'easy-spinning' : ''} />
                  <span>{testing ? 'Testing /ping & Auth...' : 'Test API Connection'}</span>
                </button>
              </div>

              {(config.has_api_key || config.has_secret_key || config.connection_status === 'connected') && (
                <button
                  type="button"
                  className="adm-btn"
                  disabled={disconnecting || saving || testing}
                  onClick={handleDisconnect}
                  style={{
                    color: '#dc2626',
                    borderColor: '#fecaca',
                    background: '#fef2f2',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 700,
                    padding: '9px 14px'
                  }}
                >
                  <Unplug size={15} />
                  <span>{disconnecting ? 'Disconnecting...' : 'Disconnect'}</span>
                </button>
              )}
            </div>

            <div style={{ marginTop: '12px', fontSize: '11.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={12} /> API Key &amp; Secret Key are AES-256-GCM encrypted at rest on the server and never exposed to the browser.
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
