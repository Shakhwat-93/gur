import React, { useState, useEffect } from 'react';
import {
  Printer,
  X,
  ChevronLeft,
  ChevronRight,
  Copy,
  Info,
  CheckCircle2,
  RotateCcw,
  SlidersHorizontal,
  Layers
} from 'lucide-react';
import ThermalSticker, { getOrderItems, chunkOrderItems } from './ThermalSticker';
import { isOrderPrinted, markOrdersAsPrinted } from '../lib/thermalPrintStorage';
import './thermalPrint.css';

/**
 * Enterprise 75mm × 100mm Direct Thermal Order Sticker Print Modal
 * Supports:
 * - Single order printing
 * - Bulk order printing
 * - Custom copy count
 * - Live physical 75mm × 100mm visual preview
 * - Thermal printer driver configuration guide
 * - Multi-item continuation label pagination
 * - Automatic printed / reprint state tracking
 */
export default function ThermalPrintModal({
  isOpen,
  onClose,
  orders = [],
  siteSettings = null,
  onPrinted = null
}) {
  const [currentOrderIndex, setCurrentOrderIndex] = useState(0);
  const [copies, setCopies] = useState(1);
  const [viewMode, setViewMode] = useState('single'); // 'single' | 'all'
  const [showGuide, setShowGuide] = useState(false);
  const [justPrinted, setJustPrinted] = useState(false);

  // Normalize orders array
  const orderList = Array.isArray(orders) ? orders.filter(Boolean) : [];

  useEffect(() => {
    setCurrentOrderIndex(0);
    setJustPrinted(false);
  }, [isOpen, orderList.length]);

  if (!isOpen || orderList.length === 0) return null;

  const currentOrder = orderList[currentOrderIndex] || orderList[0];
  const orderId = String(currentOrder.order_id || currentOrder.id);
  const isReprint = isOrderPrinted(orderId);

  // Calculate total physical stickers that will print
  const totalStickerCount = orderList.reduce((acc, ord) => {
    const items = getOrderItems(ord);
    const pages = chunkOrderItems(items).length;
    return acc + pages * copies;
  }, 0);

  const handlePrint = () => {
    const ids = orderList.map((o) => o.order_id || o.id);
    markOrdersAsPrinted(ids);
    setJustPrinted(true);

    if (onPrinted) {
      onPrinted(ids);
    }

    // Trigger native browser print dialog
    setTimeout(() => {
      window.print();
    }, 120);
  };

  return (
    <div
      className="adm-backdrop"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      style={{ zIndex: 99999 }}
    >
      <div
        className="adm-modal-sheet"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '820px', width: '95%' }}
      >
        {/* Modal Header */}
        <div className="adm-modal-header" style={{ padding: '14px 20px' }}>
          <div className="adm-modal-header-text">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#000000',
                  color: '#ffffff',
                  display: 'grid',
                  placeItems: 'center'
                }}
              >
                <Printer size={18} />
              </div>
              <h3 className="adm-modal-title" style={{ fontSize: '18px', margin: 0 }}>
                75mm × 100mm Thermal Sticker Print
              </h3>
              {orderList.length > 1 ? (
                <span className="adm-badge adm-badge-info" style={{ fontWeight: 800 }}>
                  Bulk ({orderList.length} Orders)
                </span>
              ) : isReprint ? (
                <span
                  className="adm-badge"
                  style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}
                >
                  <RotateCcw size={12} style={{ marginRight: '4px', display: 'inline' }} />
                  Reprint
                </span>
              ) : (
                <span className="adm-badge adm-badge-success">New Print</span>
              )}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#64748b' }}>
              Direct Thermal (DT) 500-label roll format · High-contrast monochrome layout
            </p>
          </div>

          <button
            type="button"
            className="adm-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body & Settings Toolbar */}
        <div className="adm-modal-body" style={{ padding: '16px 20px' }}>
          {/* Controls Bar: Copies, View Mode, Navigation */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '12px 16px',
              background: '#ffffff',
              border: '1.5px solid #e2e8f0',
              borderRadius: '12px',
              marginBottom: '16px'
            }}
          >
            {/* Left: Copies Stepper */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#334155' }}>
                Copies per Order:
              </span>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: '999px',
                  background: '#f8fafc',
                  padding: '2px'
                }}
              >
                <button
                  type="button"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    border: 'none',
                    background: '#ffffff',
                    cursor: copies > 1 ? 'pointer' : 'not-allowed',
                    fontWeight: 800,
                    fontSize: '16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                  disabled={copies <= 1}
                  onClick={() => setCopies((c) => Math.max(1, c - 1))}
                  aria-label="Decrease copies"
                >
                  −
                </button>
                <span
                  style={{
                    minWidth: '32px',
                    textAlign: 'center',
                    fontWeight: 800,
                    fontSize: '14px',
                    color: '#0f172a'
                  }}
                >
                  {copies}
                </span>
                <button
                  type="button"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    border: 'none',
                    background: '#ffffff',
                    cursor: copies < 10 ? 'pointer' : 'not-allowed',
                    fontWeight: 800,
                    fontSize: '16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                  disabled={copies >= 10}
                  onClick={() => setCopies((c) => Math.min(10, c + 1))}
                  aria-label="Increase copies"
                >
                  +
                </button>
              </div>
            </div>

            {/* Middle: Order Carousel Controls (if multiple orders) */}
            {orderList.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="adm-btn adm-btn-sm"
                  disabled={currentOrderIndex === 0}
                  onClick={() => setCurrentOrderIndex((i) => Math.max(0, i - 1))}
                  title="Previous order"
                >
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                  Order {currentOrderIndex + 1} of {orderList.length}
                </span>
                <button
                  type="button"
                  className="adm-btn adm-btn-sm"
                  disabled={currentOrderIndex === orderList.length - 1}
                  onClick={() => setCurrentOrderIndex((i) => Math.min(orderList.length - 1, i + 1))}
                  title="Next order"
                >
                  <ChevronRight size={16} />
                </button>

                {/* View Mode Toggle */}
                <button
                  type="button"
                  className="adm-btn adm-btn-sm"
                  style={{ marginLeft: '6px' }}
                  onClick={() => setViewMode((m) => (m === 'single' ? 'all' : 'single'))}
                >
                  <Layers size={14} style={{ marginRight: '4px' }} />
                  <span>{viewMode === 'single' ? 'View All' : 'Single'}</span>
                </button>
              </div>
            )}

            {/* Right: Printer Guide Button */}
            <button
              type="button"
              className="adm-btn adm-btn-sm"
              onClick={() => setShowGuide((g) => !g)}
              style={{
                background: showGuide ? '#e2e8f0' : 'transparent',
                borderColor: '#cbd5e1'
              }}
            >
              <SlidersHorizontal size={14} style={{ marginRight: '5px' }} />
              <span>Printer Setup Guide</span>
            </button>
          </div>

          {/* Collapsible Thermal Printer Driver Setup Guide */}
          {showGuide && (
            <div
              style={{
                background: '#f8fafc',
                border: '1.5px solid #cbd5e1',
                borderRadius: '12px',
                padding: '14px 18px',
                marginBottom: '16px',
                fontSize: '12.5px',
                lineHeight: '1.5',
                color: '#334155'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <Info size={16} color="#0284c7" />
                <strong style={{ color: '#0f172a', fontSize: '13px' }}>
                  Recommended Thermal Printer Settings (Xprinter / Zebra / Gprinter):
                </strong>
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', display: 'grid', gap: '4px' }}>
                <li>
                  <b>Paper Size / Label Size:</b> Select <code>75mm × 100mm</code> (or <code>3" × 4"</code> / <code>USER 75x100</code>).
                </li>
                <li>
                  <b>Margins:</b> Set to <b>None</b> (or <code>0 mm</code>) in the browser print dialog.
                </li>
                <li>
                  <b>Scale:</b> Set to <b>100% / Actual Size</b> (do <i>not</i> use "Fit to printable area").
                </li>
                <li>
                  <b>Headers and Footers:</b> <b>Uncheck</b> / Turn off (removes browser URL and page numbers).
                </li>
                <li>
                  <b>Media Type:</b> Direct Thermal (DT) Label with Gap / Black Mark.
                </li>
              </ul>
            </div>
          )}

          {/* Feedback banner if just printed */}
          {justPrinted && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                padding: '10px 14px',
                borderRadius: '8px',
                marginBottom: '14px',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              <CheckCircle2 size={18} color="#059669" />
              <span>
                Print command dispatched! Total {totalStickerCount} sticker page(s) sent to printer.
              </span>
            </div>
          )}

          {/* Physical 75mm x 100mm Sticker Preview Canvas */}
          <div className="thermal-preview-container">
            {viewMode === 'all' && orderList.length > 1 ? (
              orderList.map((ord, idx) => (
                <div key={ord.order_id || ord.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#475569' }}>
                    #{idx + 1}: Order #{ord.order_id || ord.id} ({ord.name})
                  </span>
                  <ThermalSticker
                    order={ord}
                    siteSettings={siteSettings}
                    copies={copies}
                    isOnScreen={true}
                  />
                </div>
              ))
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#475569' }}>
                  Order #{currentOrder.order_id || currentOrder.id} · {currentOrder.name}
                  {orderList.length > 1 && ` (${currentOrderIndex + 1} of ${orderList.length})`}
                </span>
                <ThermalSticker
                  order={currentOrder}
                  siteSettings={siteSettings}
                  copies={copies}
                  isOnScreen={true}
                />
              </div>
            )}
          </div>

          {/* Sticky Modal Bottom Action Row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '16px',
              paddingTop: '14px',
              borderTop: '1px solid #e2e8f0',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div style={{ fontSize: '13px', color: '#475569' }}>
              <strong>Total Output:</strong> {totalStickerCount} Sticker(s) ({orderList.length} Order{orderList.length > 1 ? 's' : ''} × {copies} Cop{copies > 1 ? 'ies' : 'y'})
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="adm-btn"
                onClick={onClose}
                style={{ padding: '10px 18px', fontWeight: 600 }}
              >
                Close
              </button>

              <button
                type="button"
                className="adm-btn"
                onClick={handlePrint}
                style={{
                  background: '#000000',
                  color: '#ffffff',
                  borderColor: '#000000',
                  padding: '10px 24px',
                  fontWeight: 800,
                  fontSize: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
                }}
              >
                <Printer size={18} />
                <span>
                  Print {totalStickerCount > 1 ? `${totalStickerCount} Stickers` : 'Sticker'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DEDICATED OFF-SCREEN PRINT MOUNT FOR WINDOW.PRINT() */}
      <div id="thermal-print-mount" className="no-screen">
        {orderList.map((ord) => (
          <ThermalSticker
            key={`print-${ord.order_id || ord.id}`}
            order={ord}
            siteSettings={siteSettings}
            copies={copies}
            isOnScreen={false}
          />
        ))}
      </div>
    </div>
  );
}
