import React from 'react';
import { Truck, RotateCw, AlertCircle, ShieldCheck } from 'lucide-react';
import './CourierStatsCard.css';

// Standard 5 BD Couriers shown on the intelligence dashboard
const STANDARD_COURIERS = [
  {
    key: 'steadfast',
    name: 'SteadFast',
    localLogo: '/images/couriers/steadfast.png',
    fallbackLogo: 'https://api.bdcourier.com/c-logo/steadfast-logo.png'
  },
  {
    key: 'pathao',
    name: 'Pathao',
    localLogo: '/images/couriers/pathao.png',
    fallbackLogo: 'https://api.bdcourier.com/c-logo/pathao-logo.png'
  },
  {
    key: 'carrybee',
    name: 'CarryBee',
    localLogo: '/images/couriers/carrybee.webp',
    fallbackLogo: 'https://api.bdcourier.com/c-logo/carrybee-logo.webp'
  },
  {
    key: 'redx',
    name: 'Redx',
    localLogo: '/images/couriers/redx.png',
    fallbackLogo: 'https://api.bdcourier.com/c-logo/redx-logo.png'
  },
  {
    key: 'paperfly',
    name: 'PaperFly',
    localLogo: '/images/couriers/paperfly.png',
    fallbackLogo: 'https://api.bdcourier.com/c-logo/paperfly-logo.png'
  }
];

export default function CourierStatsCard({
  data,
  loading = false,
  status = 'completed',
  error = null,
  retrievedAt = null,
  onSync = null,
  phone = ''
}) {
  if (status === 'disabled') {
    return null;
  }

  // Format Synced timestamp like: "Synced 17 Oct, 12:05 pm"
  const formatSyncedTime = (dateStr) => {
    try {
      const d = dateStr ? new Date(dateStr) : new Date();
      const day = d.getDate();
      const month = d.toLocaleDateString('en-US', { month: 'short' });
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'pm' : 'am';
      hours = hours % 12 || 12;
      return `Synced ${day} ${month}, ${hours}:${minutes} ${ampm}`;
    } catch {
      return 'Synced Recently';
    }
  };

  const syncedLabel = formatSyncedTime(retrievedAt || data?.retrieved_at);

  // If loading skeleton
  if (loading) {
    return (
      <div className="cri-container">
        <div className="cri-header">
          <div className="cri-header-left">
            <Truck className="cri-truck-icon" />
            <h3 className="cri-title">COURIER RATIO INTELLIGENCE</h3>
            <span className="cri-badge">BD COURIER</span>
          </div>
          <div className="cri-header-right">
            <span className="cri-sync-text">Checking live intelligence...</span>
            <button type="button" className="cri-sync-btn" disabled>
              <RotateCw size={13} className="cri-spin" />
              <span>Syncing</span>
            </button>
          </div>
        </div>
        <div className="cri-kpi-grid">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="cri-skeleton-box" />
          ))}
        </div>
        <div className="cri-skeleton-table" />
      </div>
    );
  }

  // If no data and not loading (Unverified prompt)
  if (!data || status === 'unverified') {
    return (
      <div className="cri-container">
        <div className="cri-header">
          <div className="cri-header-left">
            <Truck className="cri-truck-icon" />
            <h3 className="cri-title">COURIER RATIO INTELLIGENCE</h3>
            <span className="cri-badge">BD COURIER</span>
          </div>
        </div>
        <div className="cri-empty-state">
          <ShieldCheck size={36} className="cri-empty-icon" />
          <div className="cri-empty-title">Courier Record Not Synced Yet</div>
          <div className="cri-empty-desc">
            Check delivery success ratio, return rate, and fraud history across 5 couriers for {phone || 'this customer'}.
          </div>
          {onSync && (
            <button type="button" className="cri-probe-btn" onClick={onSync}>
              <RotateCw size={14} />
              <span>🔍 Check BD Courier Delivery History</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Extract KPI metrics
  const summary = data?.summary || {};
  const total = Number(summary.total_parcel || 0);
  const success = Number(summary.success_parcel || 0);
  const cancelled = Number(summary.cancelled_parcel || 0);
  const ratio = Math.round(Number(summary.success_ratio || (total > 0 ? (success / total) * 100 : 0)));

  // Risk level logic matching screenshot ("safe", "medium", "high risk")
  let riskLevel = 'safe';
  let riskClass = 'safe';
  if (total === 0) {
    riskLevel = 'safe';
    riskClass = 'safe';
  } else if (ratio >= 80) {
    riskLevel = 'safe';
    riskClass = 'safe';
  } else if (ratio >= 60) {
    riskLevel = 'medium';
    riskClass = 'medium';
  } else {
    riskLevel = 'high risk';
    riskClass = 'high';
  }

  const rawCouriers = data?.couriers || {};

  // Build rows for standard 5 couriers + any others returned by API
  const courierRows = STANDARD_COURIERS.map((std) => {
    const info = rawCouriers[std.key] || {};
    const cTotal = Number(info.total_parcel || 0);
    const cSuccess = Number(info.success_parcel || 0);
    const cCancelled = Number(info.cancelled_parcel || 0);
    const cRatio = Number(
      info.success_ratio !== undefined
        ? info.success_ratio
        : cTotal > 0
        ? ((cSuccess / cTotal) * 100).toFixed(1)
        : 0
    );

    return {
      key: std.key,
      name: info.name || std.name,
      logo: std.localLogo,
      fallbackLogo: info.logo || std.fallbackLogo,
      total: cTotal,
      success: cSuccess,
      cancelled: cCancelled,
      ratio: cRatio
    };
  });

  // Append any extra couriers with parcels from the API (e.g. courrierfast, parceldex)
  Object.keys(rawCouriers).forEach((k) => {
    if (!STANDARD_COURIERS.some((std) => std.key === k)) {
      const extra = rawCouriers[k];
      if (extra && extra.total_parcel > 0) {
        const cTotal = Number(extra.total_parcel || 0);
        const cSuccess = Number(extra.success_parcel || 0);
        const cCancelled = Number(extra.cancelled_parcel || 0);
        const cRatio = Number(
          extra.success_ratio !== undefined
            ? extra.success_ratio
            : cTotal > 0
            ? ((cSuccess / cTotal) * 100).toFixed(1)
            : 0
        );
        courierRows.push({
          key: k,
          name: extra.name || k.toUpperCase(),
          logo: extra.logo || null,
          fallbackLogo: null,
          total: cTotal,
          success: cSuccess,
          cancelled: cCancelled,
          ratio: cRatio
        });
      }
    }
  });

  return (
    <div className="cri-container">
      {/* Top Header Bar */}
      <div className="cri-header">
        <div className="cri-header-left">
          <Truck className="cri-truck-icon" />
          <h3 className="cri-title">COURIER RATIO INTELLIGENCE</h3>
          <span className="cri-badge">BD COURIER</span>
        </div>

        <div className="cri-header-right">
          <span className="cri-sync-text">{syncedLabel}</span>
          {onSync && (
            <button
              type="button"
              className="cri-sync-btn"
              onClick={onSync}
              title="Re-sync with BD Courier live network"
            >
              <RotateCw size={13} />
              <span>Sync Now</span>
            </button>
          )}
        </div>
      </div>

      {/* 5 KPI Metric Cards */}
      <div className="cri-kpi-grid">
        {/* Card 1: Success Ratio */}
        <div className="cri-kpi-card">
          <div className="cri-kpi-label">SUCCESS RATIO</div>
          <div className="cri-kpi-val">{ratio}%</div>
        </div>

        {/* Card 2: Total Parcels */}
        <div className="cri-kpi-card">
          <div className="cri-kpi-label">TOTAL PARCELS</div>
          <div className="cri-kpi-val">{total}</div>
        </div>

        {/* Card 3: Successful */}
        <div className="cri-kpi-card">
          <div className="cri-kpi-label">SUCCESSFUL</div>
          <div className="cri-kpi-val succ">{success}</div>
        </div>

        {/* Card 4: Cancelled */}
        <div className="cri-kpi-card">
          <div className="cri-kpi-label">CANCELLED</div>
          <div className="cri-kpi-val canc">{cancelled}</div>
        </div>

        {/* Card 5: Risk Level */}
        <div className="cri-kpi-card">
          <div className="cri-kpi-label">RISK LEVEL</div>
          <div className={`cri-kpi-val risk ${riskClass}`}>{riskLevel}</div>
        </div>
      </div>

      {/* Full Courier Intelligence Table */}
      <div className="cri-table-wrap">
        <table className="cri-table">
          <thead>
            <tr>
              <th style={{ width: '90px' }}>LOGO</th>
              <th style={{ width: '130px' }}>COURIER</th>
              <th style={{ width: '80px' }}>TOTAL</th>
              <th style={{ width: '90px' }}>SUCCESS</th>
              <th style={{ width: '100px' }}>CANCELLED</th>
              <th>SUCCESS RATIO</th>
            </tr>
          </thead>
          <tbody>
            {courierRows.map((c) => {
              const displayRatio = Number(c.ratio || 0).toFixed(1);
              const barWidth = Math.min(100, Math.max(0, Number(c.ratio || 0)));

              return (
                <tr key={c.key}>
                  {/* LOGO */}
                  <td>
                    <div className="cri-logo-box">
                      <img
                        src={c.logo}
                        alt={c.name}
                        className="cri-logo-img"
                        onError={(e) => {
                          if (c.fallbackLogo && e.target.src !== c.fallbackLogo) {
                            e.target.src = c.fallbackLogo;
                          }
                        }}
                      />
                    </div>
                  </td>

                  {/* COURIER */}
                  <td>
                    <span className="cri-courier-name">{c.name}</span>
                  </td>

                  {/* TOTAL */}
                  <td>
                    <span className="cri-total-val">{c.total}</span>
                  </td>

                  {/* SUCCESS */}
                  <td>
                    <span className="cri-succ-val">{c.success}</span>
                  </td>

                  {/* CANCELLED */}
                  <td>
                    <span className="cri-canc-val">{c.cancelled}</span>
                  </td>

                  {/* SUCCESS RATIO (Percent + Bar) */}
                  <td>
                    <div className="cri-ratio-cell">
                      <span className="cri-ratio-num">{displayRatio}%</span>
                      <div className="cri-progress-track">
                        <div
                          className="cri-progress-fill"
                          style={{
                            width: `${barWidth}%`,
                            backgroundColor: barWidth >= 70 ? '#10b981' : barWidth >= 40 ? '#f59e0b' : '#ef4444'
                          }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
