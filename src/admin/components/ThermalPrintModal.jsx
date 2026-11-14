import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  Layers,
  FileText
} from 'lucide-react';
import ThermalSticker, {
  getOrderItems,
  chunkOrderItems,
  THERMAL_PAPER_SIZES,
  DEFAULT_PAPER_SIZE
} from './ThermalSticker';
import { isOrderPrinted, markOrdersAsPrinted } from '../lib/thermalPrintStorage';
import './thermalPrint.css';

/**
 * Enterprise Direct Thermal Order Sticker Print Modal
 * Supports:
 * - 4" × 4" (101.6mm × 101.6mm) Paper Roll [Default]
 * - 150mm × 100mm (Courier 4" × 6" / Landscape)
 * - 75mm × 100mm (Compact)
 * - Zero Top-Margin Gap (Strict 4in × 4in edge-to-edge layout)
 * - Direct Portal Printing to document.body (Zero ghost pages)
 * - Strict Copy Count matching (1->1, 2->2, 3->3, 5->5, 10->10)
 * - 5-8 items multi-product layout with zero text clipping
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
  const [isPrinting, setIsPrinting] = useState(false);

  // Paper Size state with localStorage persistence
  const [paperSize, setPaperSize] = useState(() => {
    try {
      const saved = localStorage.getItem('mg_thermal_paper_size');
      return saved && THERMAL_PAPER_SIZES[saved] ? saved : DEFAULT_PAPER_SIZE;
    } catch (e) {
      return DEFAULT_PAPER_SIZE;
    }
  });

  // Strictly validated copy count
  const rawCopies = parseInt(copies, 10);
  const validatedCopies = Number.isInteger(rawCopies) && rawCopies >= 1 ? Math.min(50, rawCopies) : 1;

  // Dynamically inject exact @page dimensions when paper size changes
  useEffect(() => {
    try {
      localStorage.setItem('mg_thermal_paper_size', paperSize);
    } catch (e) {}

    const sizeCfg = THERMAL_PAPER_SIZES[paperSize] || THERMAL_PAPER_SIZES[DEFAULT_PAPER_SIZE];
    let styleEl = document.getElementById('thermal-dynamic-page-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'thermal-dynamic-page-style';
      document.head.appendChild(styleEl);
    }

    if (sizeCfg.id === '100x100') {
      styleEl.innerHTML = `
        @page {
          size: 4in 4in;
          margin: 0;
        }
        @media print {
          html, body {
            width: 4in !important;
            height: 4in !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #thermal-print-root {
            width: 4in !important;
          }
        }
      `;
    } else {
      styleEl.innerHTML = `
        @page {
          size: ${sizeCfg.widthMm}mm ${sizeCfg.heightMm}mm;
          margin: 0;
        }
        @media print {
          html, body {
            width: ${sizeCfg.widthMm}mm !important;
            height: ${sizeCfg.heightMm}mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #thermal-print-root {
            width: ${sizeCfg.widthMm}mm !important;
          }
        }
      `;
    }
  }, [paperSize]);

  // Reset print state and ALWAYS reset copies to 1 when modal opens or order list changes
  useEffect(() => {
    setCurrentOrderIndex(0);
    setJustPrinted(false);
    setIsPrinting(false);
    setCopies(1);
  }, [isOpen, orders]);

  // Clean up afterprint event
  useEffect(() => {
    const handleAfterPrint = () => {
      setIsPrinting(false);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  // Normalize orders array
  const orderList = Array.isArray(orders) ? orders.filter(Boolean) : [];

  if (!isOpen || orderList.length === 0) return null;

  const currentOrder = orderList[currentOrderIndex] || orderList[0];
  const orderId = String(currentOrder.order_id || currentOrder.id);
  const isReprint = isOrderPrinted(orderId);

  // Calculate total physical stickers that will print for selected paper size & exact copies
  const totalStickerCount = orderList.reduce((acc, ord) => {
    const items = getOrderItems(ord);
    const pages = chunkOrderItems(items, paperSize).length;
    return acc + pages * validatedCopies;
  }, 0);

  const handlePrint = () => {
    if (isPrinting) return;
    setIsPrinting(true);

    const ids = orderList.map((o) => o.order_id || o.id);
    markOrdersAsPrinted(ids);
    setJustPrinted(true);

    if (onPrinted) {
      onPrinted(ids);
    }

    // Trigger native browser print dialog safely
    setTimeout(() => {
      window.print();
      setTimeout(() => setIsPrinting(false), 1200);
    }, 120);
  };

  const activeSizeConfig = THERMAL_PAPER_SIZES[paperSize] || THERMAL_PAPER_SIZES[DEFAULT_PAPER_SIZE];

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
        style={{ maxWidth: '860px', width: '95%' }}
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
                Thermal Sticker Print ({activeSizeConfig.shortName})
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
              Direct Thermal (DT) Roll · 4in × 4in Edge-to-Edge · Exact Copy Count Guarantee
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
          {/* Paper Size Selection Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
              padding: '10px 14px',
              background: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              borderRadius: '12px',
              marginBottom: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={16} color="#0f172a" />
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                Paper Roll Size / পেপার সাইজ:
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {Object.values(THERMAL_PAPER_SIZES).map((sz) => {
                const isSelected = paperSize === sz.id;
                return (
                  <button
                    key={sz.id}
                    type="button"
                    onClick={() => setPaperSize(sz.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: isSelected ? 800 : 600,
                      cursor: 'pointer',
                      border: isSelected ? '1.5px solid #000000' : '1px solid #cbd5e1',
                      background: isSelected ? '#000000' : '#ffffff',
                      color: isSelected ? '#ffffff' : '#334155',
                      boxShadow: isSelected ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                    title={sz.description}
                  >
                    {sz.id === '100x100' ? '⭐ ' : ''}
                    {sz.label}
                  </button>
                );
              })}
            </div>
          </div>

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
            {/* Left: Copies Stepper with Direct Input & Quick Chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
                  padding: '2px 4px'
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
                    cursor: validatedCopies > 1 ? 'pointer' : 'not-allowed',
                    fontWeight: 800,
                    fontSize: '16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                  disabled={validatedCopies <= 1}
                  onClick={() => setCopies((c) => Math.max(1, (parseInt(c, 10) || 1) - 1))}
                  aria-label="Decrease copies"
                >
                  −
                </button>

                <input
                  type="number"
                  min="1"
                  max="50"
                  step="1"
                  value={copies}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setCopies('');
                    } else {
                      const num = parseInt(val, 10);
                      setCopies(isNaN(num) || num < 1 ? 1 : Math.min(50, num));
                    }
                  }}
                  onBlur={() => {
                    if (!copies || parseInt(copies, 10) < 1) {
                      setCopies(1);
                    }
                  }}
                  style={{
                    width: '42px',
                    textAlign: 'center',
                    fontWeight: 900,
                    fontSize: '14.5px',
                    color: '#0f172a',
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    padding: '2px 0'
                  }}
                  aria-label="Exact copy count"
                />

                <button
                  type="button"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    border: 'none',
                    background: '#ffffff',
                    cursor: validatedCopies < 50 ? 'pointer' : 'not-allowed',
                    fontWeight: 800,
                    fontSize: '16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                  disabled={validatedCopies >= 50}
                  onClick={() => setCopies((c) => Math.min(50, (parseInt(c, 10) || 1) + 1))}
                  aria-label="Increase copies"
                >
                  +
                </button>
              </div>

              {/* Quick Preset Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {[1, 2, 3, 5, 10].map((num) => {
                  const isCur = validatedCopies === num;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setCopies(num)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: isCur ? 800 : 600,
                        border: isCur ? '1.5px solid #000000' : '1px solid #e2e8f0',
                        background: isCur ? '#000000' : '#ffffff',
                        color: isCur ? '#ffffff' : '#475569',
                        cursor: 'pointer',
                        transition: 'all 0.1s ease'
                      }}
                      title={`Select ${num} ${num === 1 ? 'copy' : 'copies'}`}
                    >
                      {num} {num === 1 ? 'copy' : 'copies'}
                    </button>
                  );
                })}
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
                  Recommended Thermal Printer Settings (Xprinter / Zebra / Gprinter / Rongta):
                </strong>
              </div>
              <ul style={{ margin: 0, paddingLeft: '20px', display: 'grid', gap: '4px' }}>
                <li>
                  <b>Paper Size:</b> Select <code>4" × 4"</code> (or <code>100mm × 100mm</code> / <code>101.6mm × 101.6mm</code>).
                </li>
                <li>
                  <b>Margins:</b> Set to <b>None</b> (or <code>0 mm</code>) in the browser print dialog.
                </li>
                <li>
                  <b>Scale:</b> Set to <b>100% / Actual Size</b> (do <i>not</i> use "Fit to printable area").
                </li>
                <li>
                  <b>Headers and Footers:</b> <b>Uncheck</b> / Turn off (removes browser URL, date and page numbers).
                </li>
                <li>
                  <b>Copies in Windows Print Dialog:</b> Leave at <b>1</b> (copies are managed accurately by the website).
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
                Print command dispatched! Total {totalStickerCount} sticker label(s) sent to printer.
              </span>
            </div>
          )}

          {/* Physical Sticker Preview Canvas (Shows 1 representative layout per order) */}
          <div className="thermal-preview-container">
            {viewMode === 'all' && orderList.length > 1 ? (
              orderList.map((ord, idx) => (
                <div key={ord.order_id || ord.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#475569' }}>
                      #{idx + 1}: Order #{ord.order_id || ord.id} ({ord.name})
                    </span>
                    <span style={{ fontSize: '11px', background: '#e2e8f0', color: '#1e293b', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                      Printing {validatedCopies} {validatedCopies === 1 ? 'copy' : 'copies'}
                    </span>
                  </div>
                  <ThermalSticker
                    order={ord}
                    siteSettings={siteSettings}
                    copies={1}
                    paperSize={paperSize}
                    isOnScreen={true}
                  />
                </div>
              ))
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#475569' }}>
                    Order #{currentOrder.order_id || currentOrder.id} · {currentOrder.name}
                    {orderList.length > 1 && ` (${currentOrderIndex + 1} of ${orderList.length})`}
                  </span>
                  <span style={{ fontSize: '11px', background: '#e2e8f0', color: '#1e293b', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                    Printing {validatedCopies} {validatedCopies === 1 ? 'copy' : 'copies'}
                  </span>
                </div>
                <ThermalSticker
                  order={currentOrder}
                  siteSettings={siteSettings}
                  copies={1}
                  paperSize={paperSize}
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
              <strong>Total Output:</strong> {totalStickerCount} Sticker{totalStickerCount > 1 ? 's' : ''} ({orderList.length} Order{orderList.length > 1 ? 's' : ''} × {validatedCopies} {validatedCopies > 1 ? 'copies' : 'copy'}) · <b>{activeSizeConfig.shortName}</b>
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
                disabled={isPrinting}
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
                  boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                  cursor: isPrinting ? 'wait' : 'pointer',
                  opacity: isPrinting ? 0.75 : 1
                }}
              >
                <Printer size={18} />
                <span>
                  {isPrinting
                    ? 'Preparing...'
                    : `Print ${totalStickerCount > 1 ? `${totalStickerCount} Stickers` : '1 Sticker'}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DEDICATED OFF-SCREEN PRINT PORTAL (DIRECT CHILD OF DOCUMENT.BODY) */}
      {createPortal(
        <div id="thermal-print-root" aria-hidden="true">
          {orderList.map((ord) => (
            <ThermalSticker
              key={`print-root-${ord.order_id || ord.id}`}
              order={ord}
              siteSettings={siteSettings}
              copies={validatedCopies}
              paperSize={paperSize}
              isOnScreen={false}
            />
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
