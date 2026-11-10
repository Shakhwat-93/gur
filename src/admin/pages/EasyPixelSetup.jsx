import React, { useState, useEffect } from 'react';
import { Target, Save, CheckCircle2, ShieldCheck, Code, Zap, HelpCircle, Activity } from 'lucide-react';
import { useCms } from '../../context/CmsContext';
import { initTracking, trackPurchase } from '../../lib/tracking';

export default function EasyPixelSetup() {
  const { siteSettings, updateSiteSettings, showToast } = useCms();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [pixelData, setPixelData] = useState({
    fb_pixel_id: '',
    fb_capi_access_token: '',
    fb_test_event_code: '',
    tiktok_pixel_id: '',
    ga4_id: '',
    gtm_id: '',
    pixel_enabled: true
  });

  useEffect(() => {
    if (siteSettings) {
      setPixelData({
        fb_pixel_id: siteSettings.fb_pixel_id || '',
        fb_capi_access_token: siteSettings.fb_capi_access_token || '',
        fb_test_event_code: siteSettings.fb_test_event_code || '',
        tiktok_pixel_id: siteSettings.tiktok_pixel_id || '',
        ga4_id: siteSettings.ga4_id || siteSettings.ga4_measurement_id || '',
        gtm_id: siteSettings.gtm_id || '',
        pixel_enabled: siteSettings.pixel_enabled !== false
      });
    }
  }, [siteSettings]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSiteSettings({
        fb_pixel_id: pixelData.fb_pixel_id.trim(),
        fb_capi_access_token: pixelData.fb_capi_access_token.trim(),
        fb_test_event_code: pixelData.fb_test_event_code.trim(),
        tiktok_pixel_id: pixelData.tiktok_pixel_id.trim(),
        ga4_id: pixelData.ga4_id.trim(),
        gtm_id: pixelData.gtm_id.trim(),
        pixel_enabled: pixelData.pixel_enabled
      });
      showToast('Tracking and Pixel settings saved successfully');
    } catch (err) {
      console.error(err);
      showToast('Failed to save pixel settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Trigger Live Test Event for Meta Events Manager, TikTok & dataLayer
  const handleFireTestEvent = async () => {
    setTesting(true);
    try {
      const activeSettings = {
        ...siteSettings,
        ...pixelData
      };

      // Ensure trackers are initialized with active Pixel IDs
      initTracking(activeSettings);

      const dummyOrder = {
        order_id: `TEST-${Math.floor(100000 + Math.random() * 900000)}`,
        name: 'Test Customer',
        phone: '01700000000',
        package_name: '৫ ধরনের খাঁটি খেজুরের গুড় প্যাকেজ',
        quantity: 1,
        unit_price: 990,
        total_price: 990,
        delivery_fee: 0
      };

      await trackPurchase({
        order: dummyOrder,
        siteSettings: activeSettings
      });

      showToast(`Live test event fired to TikTok & Meta! (Order ID: ${dummyOrder.order_id})`);
    } catch (err) {
      console.error('Test event trigger error:', err);
      showToast('Failed to fire test event', 'error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="easy-page-wrap">
      <div className="easy-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 className="easy-page-title">Pixel, CAPI & Tracking Setup</h2>
          <p className="easy-page-desc">
            Configure Facebook Meta Pixel, Server-side Conversions API (CAPI), TikTok Pixel, and Google Analytics 4 tracking.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="easy-pill-action"
            onClick={handleFireTestEvent}
            disabled={testing}
            title="Fire a live test event to check Meta Events Manager and browser console"
          >
            <Activity size={15} />
            <span>{testing ? 'Sending Event...' : 'Send Live Test Event'}</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="easy-form-stack">
        {/* 1. Facebook Pixel & Server-Side CAPI */}
        <div className="easy-subcard">
          <div className="easy-section-head">
            <Target size={18} className="text-orange" />
            <h3>Facebook Meta Pixel & Conversions API (CAPI)</h3>
            <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#047857', padding: '3px 8px', borderRadius: '12px', fontWeight: 700, marginLeft: 'auto' }}>
              Deduplication Enabled
            </span>
          </div>

          <div className="easy-field-group">
            <label>Facebook Dataset / Pixel ID</label>
            <input
              type="text"
              className="easy-input"
              value={pixelData.fb_pixel_id}
              onChange={(e) => setPixelData({ ...pixelData, fb_pixel_id: e.target.value })}
              placeholder="e.g. 104829471928374"
            />
            <span className="easy-field-hint">
              Paste your Pixel / Dataset ID from Meta Events Manager. Tracks PageView, InitiateCheckout, and Purchase events.
            </span>
          </div>

          <div className="easy-field-group" style={{ marginTop: '12px' }}>
            <label>Facebook Conversions API (CAPI) Access Token</label>
            <textarea
              rows={2}
              className="easy-input"
              style={{ fontFamily: 'monospace', fontSize: '12.5px' }}
              value={pixelData.fb_capi_access_token}
              onChange={(e) => setPixelData({ ...pixelData, fb_capi_access_token: e.target.value })}
              placeholder="EAA..."
            />
            <span className="easy-field-hint">
              Paste your Conversions API Access Token from Meta Events Manager Settings to bypass ad-blockers and record verified server-side purchases.
            </span>
          </div>

          <div className="easy-field-group" style={{ marginTop: '12px' }}>
            <label>Facebook Test Event Code (Optional — for testing only)</label>
            <input
              type="text"
              className="easy-input"
              value={pixelData.fb_test_event_code}
              onChange={(e) => setPixelData({ ...pixelData, fb_test_event_code: e.target.value })}
              placeholder="e.g. TEST12345"
            />
            <span className="easy-field-hint">
              Found in Meta Events Manager &gt; Test Events tab. Leave blank in production after testing.
            </span>
          </div>
        </div>

        {/* 2. TikTok Pixel */}
        <div className="easy-subcard">
          <div className="easy-section-head">
            <Code size={18} className="text-orange" />
            <h3>TikTok Pixel & Events</h3>
          </div>

          <div className="easy-field-group">
            <label>TikTok Pixel ID</label>
            <input
              type="text"
              className="easy-input"
              value={pixelData.tiktok_pixel_id}
              onChange={(e) => setPixelData({ ...pixelData, tiktok_pixel_id: e.target.value })}
              placeholder="e.g. C8XXXXXXXXXXXXX"
            />
            <span className="easy-field-hint">
              TikTok Ads Manager &gt; Assets &gt; Events Manager ID. Supports ViewContent, InitiateCheckout, and CompletePayment.
            </span>
          </div>
        </div>

        {/* 3. Google Analytics 4 (GA4) & Google Tag Manager (GTM) */}
        <div className="easy-subcard">
          <div className="easy-section-head">
            <Zap size={18} className="text-orange" />
            <h3>Google Analytics 4 & Tag Manager (DataLayer)</h3>
            <span style={{ fontSize: '11px', background: '#eff6ff', color: '#1d4ed8', padding: '3px 8px', borderRadius: '12px', fontWeight: 700, marginLeft: 'auto' }}>
              dataLayer Active
            </span>
          </div>

          <div className="easy-two-col">
            <div className="easy-field-group">
              <label>GA4 Measurement ID</label>
              <input
                type="text"
                className="easy-input"
                value={pixelData.ga4_id}
                onChange={(e) => setPixelData({ ...pixelData, ga4_id: e.target.value })}
                placeholder="e.g. G-XXXXXXXXXX"
              />
            </div>

            <div className="easy-field-group">
              <label>GTM Container ID</label>
              <input
                type="text"
                className="easy-input"
                value={pixelData.gtm_id}
                onChange={(e) => setPixelData({ ...pixelData, gtm_id: e.target.value })}
                placeholder="e.g. GTM-XXXXXXX"
              />
            </div>
          </div>

          <div style={{ marginTop: '12px', padding: '12px 16px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#334155' }}>
            <div style={{ fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} color="#059669" />
              <span>Standard E-commerce DataLayer Active:</span>
            </div>
            Pushes <code>page_view</code>, package selection <code>view_item</code>, checkout start <code>begin_checkout</code>, and order completion <code>purchase</code> to <code>window.dataLayer</code>.
          </div>
        </div>

        {/* Master Active Switch */}
        <div className="easy-subcard" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '15px' }}>Enable All Tracking Scripts</div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>When disabled, all external pixel scripts and events are suppressed.</div>
          </div>
          <label className="easy-switch">
            <input
              type="checkbox"
              checked={pixelData.pixel_enabled}
              onChange={(e) => setPixelData({ ...pixelData, pixel_enabled: e.target.checked })}
            />
            <span className="easy-slider round"></span>
          </label>
        </div>

        {/* Submit Button */}
        <div className="easy-submit-wrap">
          <button type="submit" className="easy-save-btn" disabled={saving}>
            <Save size={18} />
            <span>{saving ? 'Saving...' : 'Save Tracking Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
