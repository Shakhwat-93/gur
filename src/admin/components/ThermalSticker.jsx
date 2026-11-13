import React from 'react';
import BarcodeRenderer from './BarcodeRenderer';
import QrCodeRenderer from './QrCodeRenderer';
import { getEffectiveOrderQty } from '../../lib/orderHelper';
import './thermalPrint.css';

export const THERMAL_PAPER_SIZES = {
  '100x100': {
    id: '100x100',
    name: '4" × 4" (100mm × 100mm)',
    label: '4" × 4" Roll (100×100mm)',
    shortName: '4" × 4"',
    widthMm: 100,
    heightMm: 100,
    maxItemsSinglePage: 8,
    description: '4 ইঞ্চি বাই 4 ইঞ্চি পেপার রোল (স্কয়ার থার্মাল স্টিকার)'
  },
  '100x150': {
    id: '100x150',
    name: '150mm × 100mm / 4" × 6" (Courier Portrait)',
    label: '150mm × 100mm (4" × 6")',
    shortName: '150×100mm',
    widthMm: 100,
    heightMm: 150,
    maxItemsSinglePage: 12,
    description: '150mm × 100mm লম্বা কুরিয়ার শিপিং লেবেল'
  },
  '150x100': {
    id: '150x100',
    name: '150mm × 100mm (Landscape 6" × 4")',
    label: '150×100mm Landscape',
    shortName: '150×100mm L',
    widthMm: 150,
    heightMm: 100,
    maxItemsSinglePage: 8,
    description: '150mm চওড়া ল্যান্ডস্কেপ থার্মাল লেবেল'
  },
  '75x100': {
    id: '75x100',
    name: '75mm × 100mm (3" × 4" Compact)',
    label: '75mm × 100mm (Compact)',
    shortName: '75×100mm',
    widthMm: 75,
    heightMm: 100,
    maxItemsSinglePage: 5,
    description: 'ছোট ৩ ইঞ্চি থার্মাল পেপার রোল'
  }
};

export const DEFAULT_PAPER_SIZE = '100x100';

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
 * Splits items into pages if an order has more products than fits on one sticker.
 * Dynamically adjusts max items per sticker based on selected paper size:
 * - 4" × 4" (100mm × 100mm): up to 8 items on 1 page without pagination
 * - 150mm × 100mm (100×150mm): up to 12 items on 1 page
 * - 75mm × 100mm: up to 5 items on 1 page
 */
export function chunkOrderItems(items, paperSizeId = DEFAULT_PAPER_SIZE) {
  if (!items || items.length === 0) return [[]];
  const sizeConfig = THERMAL_PAPER_SIZES[paperSizeId] || THERMAL_PAPER_SIZES[DEFAULT_PAPER_SIZE];
  const maxItems = sizeConfig.maxItemsSinglePage || 8;

  if (items.length <= maxItems) {
    return [items];
  }

  const pages = [];
  const firstPageLimit = maxItems - 1;
  pages.push(items.slice(0, firstPageLimit));

  let cursor = firstPageLimit;
  while (cursor < items.length) {
    pages.push(items.slice(cursor, cursor + maxItems));
    cursor += maxItems;
  }
  return pages;
}

/**
 * Single Direct Thermal Sticker Page
 */
export function SingleThermalStickerPage({
  order,
  siteSettings,
  pageItems,
  pageIndex,
  totalPages,
  copyIndex = 1,
  totalCopies = 1,
  paperSize = DEFAULT_PAPER_SIZE,
  isOnScreen = false
}) {
  if (!order) return null;

  const sizeConfig = THERMAL_PAPER_SIZES[paperSize] || THERMAL_PAPER_SIZES[DEFAULT_PAPER_SIZE];
  const itemCount = pageItems.length;
  const densityClass =
    itemCount <= 3
      ? 'ts-density-spacious'
      : itemCount <= 5
      ? 'ts-density-medium'
      : 'ts-density-compact';

  const storeName = siteSettings?.store_name || 'ম্যাংগো গার্ডেন';
  const storeLogo = siteSettings?.logo_url || '/img/logo.jpg';
  const storePhone = siteSettings?.phone_1 || '01318-007554';

  const orderId = String(order.order_id || order.id || 'KB-0000').trim();
  const customerName = order.name || 'সম্মানিত গ্রাহক';
  const customerPhone = order.phone || '01XXXXXXXXX';
  const altPhone = order.alt_phone || order.phone_2 || '';
  const customerAddress = order.address || 'বাংলাদেশ';

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

  // Tracking payload for QR Code (Direct verifiable link / Order ID)
  const qrTrackingUrl = `https://mangogardenbd.com/#order-track?id=${encodeURIComponent(orderId)}`;

  return (
    <div
      className={`thermal-sticker-page size-${paperSize} ${densityClass} ${isOnScreen ? 'on-screen' : ''}`}
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
              SHIPPING LABEL {totalPages > 1 ? `(${pageIndex + 1}/${totalPages})` : ''}
            </span>
          </div>
        </div>

        <div className="ts-order-col">
          <div className="ts-order-pill">
            {order.status ? String(order.status).toUpperCase() : 'ORDER'}
            {totalCopies > 1 ? ` · COPY ${copyIndex}/${totalCopies}` : ''}
          </div>
          <div className="ts-order-id-large">#{orderId}</div>
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
          <span>Courier: {siteSettings?.courier_provider || 'Steadfast'}</span>
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
            {pageItems.map((item, idx) => (
              <tr key={idx}>
                <td>
                  <div className="ts-item-name">{item.name}</div>
                  <div className="ts-item-sub">
                    {item.sku ? `SKU: ${item.sku}` : ''}
                    {item.variant ? ` · ${item.variant}` : ''}
                    {item.color ? ` · ${item.color}` : ''}
                    {item.size ? ` · ${item.size}` : ''}
                  </div>
                </td>
                <td className="num font-mono"><b>{item.quantity}</b></td>
                <td className="num font-mono">৳{item.unitPrice}</td>
                <td className="num font-mono"><b>৳{item.subtotal}</b></td>
              </tr>
            ))}
          </tbody>
        </table>

        {!isLastPage && (
          <div className="ts-contd-notice">
            ▼ Continued on Page {pageIndex + 2} of {totalPages}
          </div>
        )}
      </div>

      {/* 4. PAYMENT & SUMMARY SECTION (Show summary on last page, or total line on continuation) */}
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

      {/* 5. FOOTER & BARCODE SECTION */}
      <div className="ts-footer">
        <div className="ts-barcode-col">
          <BarcodeRenderer
            value={orderId}
            width={1.25}
            height={28}
            fontSize={9}
            displayValue={true}
          />
          <div className="ts-notice-text">
            জরুরি প্রয়োজনে: {storePhone} · পার্সেল চেক করে বুঝে নিন
          </div>
          <div className="ts-meta-sub">
            <span>Mango Garden Official</span>
            <span>
              Page {pageIndex + 1}/{totalPages}
            </span>
          </div>
        </div>

        <div className="ts-qr-col">
          <QrCodeRenderer value={qrTrackingUrl} size={48} />
          <span style={{ fontSize: '6px', fontWeight: 800, marginTop: '1px' }}>VERIFY</span>
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

  const items = getOrderItems(order);
  const itemPages = chunkOrderItems(items, paperSize);
  const totalPages = itemPages.length;

  const renderedPages = [];

  for (let c = 1; c <= copies; c++) {
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
          totalCopies={copies}
          paperSize={paperSize}
          isOnScreen={isOnScreen}
        />
      );
    });
  }

  return <>{renderedPages}</>;
}
