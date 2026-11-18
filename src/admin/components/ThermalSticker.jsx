import React from 'react';
import BarcodeRenderer from './BarcodeRenderer';
import QrCodeRenderer from './QrCodeRenderer';
import { getEffectiveOrderQty } from '../../lib/orderHelper';
import './thermalPrint.css';

export const THERMAL_PAPER_SIZES = {
  '100x150': {
    id: '100x150',
    name: '100mm × 150mm (4" × 6" Courier Shipping Label)',
    label: '100mm × 150mm (Standard)',
    shortName: '100×150mm',
    widthMm: 100,
    heightMm: 150,
    cssWidth: '100mm',
    cssHeight: '150mm',
    isContinuous: false,
    description: '100mm × 150mm স্ট্যান্ডার্ড কুরিয়ার শিপিং লেবেল রোল (ডিফল্ট)'
  },
  '100x100': {
    id: '100x100',
    name: '4" × 4" (100mm × 100mm Square)',
    label: '4" × 4" (100×100mm)',
    shortName: '4" × 4"',
    widthMm: 100,
    heightMm: 100,
    cssWidth: '100mm',
    cssHeight: '100mm',
    isContinuous: false,
    description: '100mm × 100mm (৪×৪ ইঞ্চি) স্কয়ার স্টিকার রোল'
  },
  'continuous': {
    id: 'continuous',
    name: '100mm Continuous Roll (Auto-Height)',
    label: '100mm Continuous (Auto)',
    shortName: '100mm Auto',
    widthMm: 100,
    heightMm: 'auto',
    cssWidth: '100mm',
    cssHeight: 'auto',
    isContinuous: true,
    description: '100mm রসিদ রোল (যত আইটেমই থাকুক ১ পেজে একটানা প্রিন্ট)'
  },
  '80mm': {
    id: '80mm',
    name: '80mm POS Thermal Receipt',
    label: '80mm POS Receipt',
    shortName: '80mm POS',
    widthMm: 80,
    heightMm: 'auto',
    cssWidth: '80mm',
    cssHeight: 'auto',
    isContinuous: true,
    description: 'স্ট্যান্ডার্ড 80mm থার্মাল পিওএস রসিদ পেপার'
  },
  '58mm': {
    id: '58mm',
    name: '58mm Mini POS Thermal Receipt',
    label: '58mm POS Receipt',
    shortName: '58mm POS',
    widthMm: 58,
    heightMm: 'auto',
    cssWidth: '58mm',
    cssHeight: 'auto',
    isContinuous: true,
    description: 'ছোট 58mm ব্লুটুথ থার্মাল রসিদ পেপার'
  },
  '75x100': {
    id: '75x100',
    name: '75mm × 100mm (3" × 4" Compact)',
    label: '75mm × 100mm (Compact)',
    shortName: '75×100mm',
    widthMm: 75,
    heightMm: 100,
    cssWidth: '75mm',
    cssHeight: '100mm',
    isContinuous: false,
    description: 'ছোট ৩ ইঞ্চি থার্মাল পেপার রোল'
  }
};

export const DEFAULT_PAPER_SIZE = '100x150';

/**
 * Normalizes and extracts structured items for an order.
 * Handles both rich JSON items array and legacy order schema fields.
 */
export function getOrderItems(order) {
  if (!order) return [];

  if (Array.isArray(order.items) && order.items.length > 0) {
    return order.items.map((it, idx) => ({
      name: it.name || it.title || it.label || it.product_name || `Item ${idx + 1}`,
      sku: it.sku || it.id || it.package_id || `SKU-${idx + 1}`,
      variant: it.variant || it.unit || it.weight || '',
      color: it.color || '',
      size: it.size || '',
      quantity: Number(it.quantity || it.qty || 1),
      unitPrice: Number(it.price || it.unit_price || 0),
      subtotal: Number(it.total || (it.price || it.unit_price || 0) * (it.quantity || it.qty || 1))
    }));
  }

  // Graceful fallback from order summary fields
  const qty = getEffectiveOrderQty(order);
  const total = Number(order.total_price || order.total || 0);
  const delivery = Number(order.delivery_charge || order.delivery_fee || 0);
  const unitPrice = Number(order.unit_price || (qty > 0 ? (total - delivery) / qty : total));

  return [
    {
      name: order.package_name || order.product_name || 'খাঁটি খেজুরের গুড়',
      sku: order.package_id || 'KB-PACK',
      variant: order.unit ? `${qty} ${order.unit}` : '১টি প্যাকেজ',
      color: '',
      size: '',
      quantity: qty,
      unitPrice: unitPrice,
      subtotal: unitPrice * qty
    }
  ];
}

/**
 * Slices order items into a single unified invoice array.
 * Ensures the entire invoice, all products, total amount, COD, and barcode/QR
 * permanently stay together on ONE single thermal invoice page.
 */
export function chunkOrderItems(items) {
  if (!items || items.length === 0) return [[]];
  return [items];
}

/**
 * Single Direct Thermal Sticker / Invoice Page Component
 */
export function SingleThermalStickerPage({
  order,
  siteSettings,
  pageItems,
  pageIndex = 0,
  totalPages = 1,
  copyIndex = 1,
  totalCopies = 1,
  paperSize = DEFAULT_PAPER_SIZE,
  isOnScreen = false
}) {
  if (!order) return null;

  const sizeConfig = THERMAL_PAPER_SIZES[paperSize] || THERMAL_PAPER_SIZES[DEFAULT_PAPER_SIZE];
  const itemCount = pageItems.length;
  const densityClass =
    itemCount <= 2
      ? 'ts-density-spacious'
      : itemCount <= 5
      ? 'ts-density-medium'
      : itemCount <= 8
      ? 'ts-density-compact'
      : 'ts-density-ultra-compact';

  const is58mm = paperSize === '58mm';
  const is80mm = paperSize === '80mm';
  const is75mm = paperSize === '75x100';
  const is100x150 = paperSize === '100x150';

  let barcodeWidth = 1.4;
  let barcodeHeight = 38;
  let barcodeFontSize = 10;
  let qrSize = 56;

  if (is58mm) {
    barcodeWidth = 0.95;
    barcodeHeight = 20;
    barcodeFontSize = 7;
    qrSize = 32;
  } else if (is80mm) {
    barcodeWidth = 1.1;
    barcodeHeight = 24;
    barcodeFontSize = 8;
    qrSize = 40;
  } else if (is75mm) {
    barcodeWidth = 1.05;
    barcodeHeight = itemCount <= 5 ? 26 : 22;
    barcodeFontSize = 8;
    qrSize = itemCount <= 5 ? 42 : 36;
  } else if (is100x150) {
    // 100mm × 150mm: generous vertical area allows high-readability barcode and large QR code
    if (itemCount <= 3) {
      barcodeWidth = 1.5;
      barcodeHeight = 44;
      barcodeFontSize = 11;
      qrSize = 64;
    } else if (itemCount <= 6) {
      barcodeWidth = 1.45;
      barcodeHeight = 40;
      barcodeFontSize = 10.5;
      qrSize = 58;
    } else if (itemCount <= 9) {
      barcodeWidth = 1.35;
      barcodeHeight = 34;
      barcodeFontSize = 9.5;
      qrSize = 52;
    } else {
      barcodeWidth = 1.25;
      barcodeHeight = 28;
      barcodeFontSize = 9;
      qrSize = 46;
    }
  } else {
    // 100mm x 100mm & continuous — full-area balanced sizing
    if (itemCount <= 2) {
      barcodeWidth = 1.4;
      barcodeHeight = 36;
      barcodeFontSize = 10;
      qrSize = 56;
    } else if (itemCount <= 5) {
      barcodeWidth = 1.3;
      barcodeHeight = 30;
      barcodeFontSize = 9;
      qrSize = 48;
    } else if (itemCount <= 8) {
      barcodeWidth = 1.22;
      barcodeHeight = 26;
      barcodeFontSize = 8.5;
      qrSize = 44;
    } else {
      barcodeWidth = 1.15;
      barcodeHeight = 22;
      barcodeFontSize = 8;
      qrSize = 38;
    }
  }

  const storeName = siteSettings?.store_name || 'ম্যাংগো গার্ডেন';
  const storeLogo = siteSettings?.logo_url || '/img/logo.jpg';
  const storePhone = siteSettings?.phone_1 || '01318-007554';

  const orderId = String(order.order_id || order.id || 'KB-0000').trim();
  const consignmentId = String(order.consignment_id || '').trim();
  const trackingCode = String(order.tracking_code || '').trim();
  const hasCourierConsignment = Boolean(consignmentId);
  const courierLabelName = hasCourierConsignment
    ? 'eShipFirst'
    : siteSettings?.courier_provider || 'Steadfast';

  // Prioritize eShipFirst Consignment ID as the primary courier identifier on labels & barcode
  const primaryDisplayId = hasCourierConsignment ? `CID #${consignmentId}` : `#${orderId}`;
  const primaryBarcodeValue = hasCourierConsignment ? consignmentId : orderId;

  const customerName = order.name || order.recipient_name || 'সম্মানিত গ্রাহক';
  const customerPhone = order.phone || order.recipient_phone || '01XXXXXXXXX';
  const altPhone = order.alt_phone || order.phone_2 || '';
  const customerAddress = order.address || order.recipient_address || 'বাংলাদেশ';

  // Area & Zone detection
  const isInsideDhaka =
    order.area === 'inside_dhaka' ||
    customerAddress.toLowerCase().includes('dhaka') ||
    customerAddress.includes('ঢাকা');
  const deliveryZone = isInsideDhaka ? 'Inside Dhaka' : 'Outside Dhaka';

  // Financial calculations
  const deliveryFee = Number(order.delivery_charge || order.delivery_fee || 0);
  const discount = Number(order.discount || 0);
  const totalPrice = Number(order.total_price || order.total || 0);
  const subtotal = Number(order.subtotal || Math.max(0, totalPrice - deliveryFee + discount));

  // Payment status
  const isPaid =
    order.payment_status === 'paid' ||
    order.paid === true ||
    (order.paid_amount && Number(order.paid_amount) >= totalPrice);
  const dueAmount = isPaid ? 0 : totalPrice;

  // Format creation date
  const orderDate = order.created_at
    ? new Date(order.created_at).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

  const isLastPage = pageIndex === totalPages - 1;

  // Tracking payload for QR Code (uses eShipFirst Consignment/Tracking when available)
  const qrTrackingUrl = hasCourierConsignment
    ? trackingCode
      ? `https://steadfast.com.bd/t/${encodeURIComponent(trackingCode)}`
      : `https://mangogardenbd.com/#order-track?cid=${encodeURIComponent(consignmentId)}&id=${encodeURIComponent(orderId)}`
    : `https://mangogardenbd.com/#order-track?id=${encodeURIComponent(orderId)}`;

  return (
    <div
      className={`thermal-sticker-page shipping-label size-${paperSize} ${densityClass} ${isOnScreen ? 'on-screen' : ''}`}
      data-paper-size={paperSize}
      data-items-count={itemCount}
    >
      {/* 1. HEADER SECTION */}
      <div className="ts-header">
        <div className="ts-brand-col">
          <img src={storeLogo} alt={storeName} className="ts-logo-img" />
          <div className="ts-brand-text">
            <span className="ts-store-name">{storeName}</span>
            <span className="ts-label-type">
              {hasCourierConsignment ? 'ESHIPFIRST PARCEL' : 'SHIPPING LABEL'}{' '}
              {totalPages > 1 ? `(${pageIndex + 1}/${totalPages})` : ''}
            </span>
          </div>
        </div>

        <div className="ts-order-col">
          <div className="ts-order-pill">
            {hasCourierConsignment
              ? 'ESHIPFIRST'
              : order.status
              ? String(order.status).toUpperCase()
              : 'ORDER'}
            {totalCopies > 1 ? ` · COPY ${copyIndex}/${totalCopies}` : ''}
          </div>
          <div className="ts-order-id-large">{primaryDisplayId}</div>
          {hasCourierConsignment && (
            <div className="ts-tracking-sub">
              {trackingCode ? `TRK: ${trackingCode}` : `REF: #${orderId}`}
            </div>
          )}
        </div>
      </div>

      {/* 2. CUSTOMER INFORMATION BOX */}
      <div className="ts-customer-box">
        <div className="ts-box-tag">
          <span>SHIP TO / প্রাপক:</span>
          <span className="ts-zone-badge">{deliveryZone}</span>
        </div>

        <div className="ts-cust-name-row">
          <span className="ts-cust-name" title={customerName}>
            {customerName}
          </span>
          <span className="ts-cust-phone">{customerPhone}</span>
        </div>

        {altPhone && altPhone !== customerPhone && (
          <div style={{ fontSize: '8px', color: '#000000', fontWeight: 700 }}>
            Alt Phone: <span style={{ fontFamily: 'monospace' }}>{altPhone}</span>
          </div>
        )}

        <div className="ts-cust-address" title={customerAddress}>
          {customerAddress}
        </div>

        <div className="ts-cust-meta-row">
          <span>
            Courier: {courierLabelName}
            {hasCourierConsignment && trackingCode ? ` · Ref #${orderId}` : ''}
          </span>
          <span>Date: {orderDate}</span>
        </div>
      </div>

      {/* 3. PRODUCT INFORMATION TABLE */}
      <div className="ts-items-section">
        <table className="ts-items-table">
          <thead>
            <tr>
              <th style={{ width: '56%' }}>Item & Spec</th>
              <th className="num" style={{ width: '12%' }}>Qty</th>
              <th className="num" style={{ width: '15%' }}>Price</th>
              <th className="num" style={{ width: '17%' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((item, idx) => {
              // Only display variant subtitle if it's meaningful and not already part of the name
              const cleanVariant = item.variant && !item.name.includes(item.variant) ? item.variant : '';
              return (
                <tr key={idx}>
                  <td>
                    <div className="ts-item-name">
                      {item.name}
                      {cleanVariant && <span className="ts-item-variant-inline"> ({cleanVariant})</span>}
                    </div>
                  </td>
                  <td className="num font-mono"><b>{item.quantity}</b></td>
                  <td className="num font-mono">৳{item.unitPrice}</td>
                  <td className="num font-mono"><b>৳{item.subtotal}</b></td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!isLastPage && (
          <div className="ts-contd-notice">
            ▼ Continued on Page {pageIndex + 2} of {totalPages}
          </div>
        )}
      </div>

      {/* 4 & 5. ATOMIC BOTTOM CLUSTER (Summary + COD + Barcode + QR Code)
          Glued together with break-inside: avoid and break-before: avoid to guarantee
          that Barcode and QR code NEVER get pushed to a second page! */}
      <div className="ts-bottom-cluster">
        {/* PAYMENT & SUMMARY SECTION */}
        <div className="ts-summary-wrap">
          <div className="ts-calc-rows">
            <div className="ts-calc-left">
              <span>Subtotal: ৳{subtotal}</span>
              <span>Delivery: {deliveryFee === 0 ? 'FREE' : `৳${deliveryFee}`}</span>
              {discount > 0 && <span>Disc: -৳{discount}</span>}
            </div>
            <div style={{ fontFamily: 'monospace', fontWeight: 900 }}>
              Total: ৳{totalPrice}
            </div>
          </div>

          {/* High-visibility Inverted COD banner */}
          <div className={`ts-cod-banner ${isPaid ? 'paid' : ''}`}>
            <div className="ts-cod-label">
              {isPaid ? '✓ PAID IN FULL · NO CASH TO COLLECT' : '★ CASH ON DELIVERY (COD):'}
            </div>
            <div className="ts-cod-amount">
              {isPaid ? '৳ 0 DUE' : `৳ ${dueAmount}`}
            </div>
          </div>
        </div>

        {/* FOOTER & BARCODE SECTION */}
        <div className="ts-footer">
          <div className="ts-barcode-col">
            <BarcodeRenderer
              value={primaryBarcodeValue}
              width={barcodeWidth}
              height={barcodeHeight}
              fontSize={barcodeFontSize}
              displayValue={true}
            />
            <div className="ts-notice-text">
              জরুরি প্রয়োজনে: {storePhone} · পার্সেল চেক করে বুঝে নিন
            </div>
            <div className="ts-meta-sub">
              <span>Mango Garden Official</span>
              <span>Page {pageIndex + 1}/{totalPages}</span>
            </div>
          </div>

          <div className="ts-qr-col">
            <QrCodeRenderer value={qrTrackingUrl} size={qrSize} />
            <span className="ts-qr-caption">VERIFY</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Main Thermal Sticker Component for an Order.
 * Automatically paginates items into 1 or more 75mm × 100mm stickers.
 */
export default function ThermalSticker({
  order,
  siteSettings,
  copies = 1,
  paperSize = DEFAULT_PAPER_SIZE,
  isOnScreen = false
}) {
  if (!order) return null;

  // Strictly validate copies as positive integer (defaults to 1, max 50)
  const rawCopies = parseInt(copies, 10);
  const validCopies = Number.isInteger(rawCopies) && rawCopies >= 1 ? Math.min(50, rawCopies) : 1;

  const items = getOrderItems(order);
  const itemPages = chunkOrderItems(items, paperSize);
  const totalPages = itemPages.length;

  const renderedPages = [];

  for (let c = 1; c <= validCopies; c++) {
    itemPages.forEach((pageItems, pageIdx) => {
      renderedPages.push(
        <SingleThermalStickerPage
          key={`ord-${order.order_id || order.id}-copy-${c}-pg-${pageIdx}-${paperSize}`}
          order={order}
          siteSettings={siteSettings}
          pageItems={pageItems}
          pageIndex={pageIdx}
          totalPages={totalPages}
          copyIndex={c}
          totalCopies={validCopies}
          paperSize={paperSize}
          isOnScreen={isOnScreen}
        />
      );
    });
  }

  return <>{renderedPages}</>;
}
