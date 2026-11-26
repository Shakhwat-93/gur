import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingBag,
  User,
  Phone,
  MapPin,
  Truck,
  Plus,
  Trash2,
  Printer,
  Copy,
  Check,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  AlertTriangle,
  X,
  CreditCard,
  FileText
} from 'lucide-react';
import { useCms } from '../../context/CmsContext';
import { normalizeBdPhone, isValidBdPhone } from '../../lib/phoneNormalizer';
import { formatOrderCourierText } from '../../lib/orderHelper';
import { orderOptions, FREE_BONUS_MIN_KG, FREE_BONUS_ITEM_NAME } from '../../data';
import { fetchEShipFirstFraudScore } from '../lib/eshipfirstClient';
import './createOrderModal.css';

export default function CreateOrderModal({
  isOpen,
  onClose,
  onOrderCreated,
  onOpenPrint
}) {
  const { orders = [], createManualOrder, showToast } = useCms();

  // Form State (Phone first, then Name, then Address)
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('inside_dhaka'); // 'inside_dhaka' | 'outside_dhaka'
  const [orderSource, setOrderSource] = useState('phone'); // 'phone' | 'whatsapp' | 'messenger' | 'offline'
  const [orderStatus, setOrderStatus] = useState('confirmed'); // default to confirmed for manual orders
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [notes, setNotes] = useState('');

  // Live Courier Ratio & Fraud Check State
  const [courierCheckState, setCourierCheckState] = useState({
    status: 'idle', // 'idle' | 'loading' | 'completed' | 'error'
    data: null,
    error: null,
    phone: '',
    source: 'BD Courier'
  });
  const [repeatCustomerOrders, setRepeatCustomerOrders] = useState([]);
  const lastAutoFilledPhoneRef = useRef('');
  const latestLookupPhoneRef = useRef('');

  // Selected Items State: array of { id, name, price, quantity, unit }
  const [selectedItems, setSelectedItems] = useState(() => {
    // Default to best seller combo pack
    const defaultCombo = orderOptions.find((o) => o.isCombo) || orderOptions[0];
    return defaultCombo
      ? [
          {
            id: defaultCombo.id,
            name: defaultCombo.label,
            price: defaultCombo.price,
            quantity: 1,
            unit: defaultCombo.unit || 'প্যাকেজ',
            isCombo: true
          }
        ]
      : [];
  });

  const [deliveryCharge, setDeliveryCharge] = useState(0); // Combo default is free shipping
  const [discount, setDiscount] = useState(0);
  const [catalogSelectId, setCatalogSelectId] = useState(orderOptions[0]?.id || '');

  // Custom Manual Product State
  const [itemAddMode, setItemAddMode] = useState('catalog'); // 'catalog' | 'custom'
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customUnit, setCustomUnit] = useState('কেজি');
  const [customQty, setCustomQty] = useState(1);

  // Submission & Post-Creation States
  const [submitting, setSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);
  const [copiedText, setCopiedText] = useState(false);
  const [errors, setErrors] = useState({});

  // Normalize eShipFirst fraud payload into a standard courier summary object
  const normalizeEshipFraudPayload = (raw, normPhone) => {
    const d = raw?.data || raw || {};
    const summaryObj = d.summary || d;

    const deliveredCount = Number(
      summaryObj.success_parcel ??
        summaryObj.delivered_count ??
        summaryObj.delivered_parcels ??
        summaryObj.delivered ??
        summaryObj.success ??
        d.delivered_count ??
        d.success_parcel ??
        0
    );
    const cancelledCount = Number(
      summaryObj.cancelled_parcel ??
        summaryObj.cancelled_count ??
        summaryObj.returned_parcels ??
        summaryObj.cancelled ??
        summaryObj.returned ??
        d.cancelled_count ??
        d.cancelled_parcel ??
        0
    );
    const rawTotal = Number(
      summaryObj.total_parcel ??
        summaryObj.total_parcels ??
        summaryObj.total ??
        d.total_parcel ??
        d.total_parcels ??
        0
    );
    const total = rawTotal > 0 ? rawTotal : deliveredCount + cancelledCount;

    const ratio =
      summaryObj.success_ratio !== undefined && summaryObj.success_ratio !== null
        ? Number(summaryObj.success_ratio)
        : d.delivery_ratio !== undefined && d.delivery_ratio !== null
        ? Number(d.delivery_ratio)
        : total > 0
        ? Number(((deliveredCount / total) * 100).toFixed(1))
        : 0;

    return {
      phone: normPhone,
      summary: {
        total_parcel: total,
        success_parcel: deliveredCount,
        cancelled_parcel: cancelledCount,
        success_ratio: ratio
      },
      total_reports: Number(d.total_reports || 0),
      fraud_categories: d.fraud_categories || null,
      volume_range: d.volume_range || null,
      couriers: d.couriers || {}
    };
  };

  // Trigger Courier Ratio & Fraud Rate Lookup for a valid 11-digit BD phone number
  const runCourierRatioCheck = async (normPhone, forceRefresh = false) => {
    if (!isValidBdPhone(normPhone)) return;
    latestLookupPhoneRef.current = normPhone;

    setCourierCheckState({
      status: 'loading',
      data: null,
      error: null,
      phone: normPhone,
      source: 'BD Courier'
    });

    try {
      const res = await fetch('/api/courier-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normPhone, forceRefresh })
      });
      const json = await res.json().catch(() => ({}));

      // Ignore stale response if user already typed a different phone number
      if (latestLookupPhoneRef.current !== normPhone) return;

      if (json?.status === 'completed' && json?.data) {
        setCourierCheckState({
          status: 'completed',
          data: json.data,
          error: null,
          phone: normPhone,
          source: json.data.provider || 'BD Courier'
        });
        return;
      }

      // Secondary fallback: try eShipFirst fraud check endpoint if BD Courier is disabled or unavailable
      const eshipRes = await fetchEShipFirstFraudScore(normPhone).catch(() => null);
      if (latestLookupPhoneRef.current !== normPhone) return;

      if (eshipRes?.ok && eshipRes?.data?.success && eshipRes?.data?.data) {
        const normalizedData = normalizeEshipFraudPayload(eshipRes.data.data, normPhone);
        setCourierCheckState({
          status: 'completed',
          data: normalizedData,
          error: null,
          phone: normPhone,
          source: 'eShipFirst'
        });
        return;
      }

      // Fallback 3: Compute from local store order history if external APIs are disabled/unconfigured
      const localMatches = (orders || []).filter(
        (o) => normalizeBdPhone(o.phone) === normPhone
      );
      if (localMatches.length > 0) {
        const total = localMatches.length;
        const cancelled = localMatches.filter((o) => o.status === 'cancelled').length;
        const success = total - cancelled;
        const ratio = Number(((success / total) * 100).toFixed(1));
        setCourierCheckState({
          status: 'completed',
          data: {
            phone: normPhone,
            summary: {
              total_parcel: total,
              success_parcel: success,
              cancelled_parcel: cancelled,
              success_ratio: ratio
            },
            couriers: {}
          },
          error: null,
          phone: normPhone,
          source: 'Store History'
        });
        return;
      }

      setCourierCheckState({
        status: 'error',
        data: null,
        error:
          json?.message ||
          json?.error ||
          eshipRes?.data?.error ||
          'কুরিয়ার এপিআই কনফিগার করা নেই অথবা ডাটা পাওয়া যায়নি',
        phone: normPhone,
        source: 'BD Courier'
      });
    } catch (err) {
      if (latestLookupPhoneRef.current !== normPhone) return;
      setCourierCheckState({
        status: 'error',
        data: null,
        error: err.message || 'কুরিয়ার রেশিও চেক করতে ত্রুটি হয়েছে',
        phone: normPhone,
        source: 'BD Courier'
      });
    }
  };

  // Automatic phone watcher: checks repeat customer + triggers live courier ratio check
  useEffect(() => {
    if (!isOpen) return;

    const normPhone = normalizeBdPhone(phone);
    if (!isValidBdPhone(normPhone)) {
      latestLookupPhoneRef.current = '';
      setRepeatCustomerOrders([]);
      setCourierCheckState((prev) =>
        prev.status === 'idle' ? prev : { status: 'idle', data: null, error: null, phone: '', source: 'BD Courier' }
      );
      return;
    }

    // 1. Check store orders for returning customer & auto-fill Name/Address if blank
    const matches = (orders || []).filter(
      (o) => normalizeBdPhone(o.phone) === normPhone
    );
    setRepeatCustomerOrders(matches);

    if (matches.length > 0 && lastAutoFilledPhoneRef.current !== normPhone) {
      const latestOrd = matches[0];
      lastAutoFilledPhoneRef.current = normPhone;
      setCustomerName((prev) => (prev.trim() ? prev : latestOrd.name || ''));
      setAddress((prev) => (prev.trim() ? prev : latestOrd.address || ''));
      if (latestOrd.area === 'inside_dhaka' || latestOrd.area === 'outside_dhaka') {
        setArea(latestOrd.area);
      }
    }

    // 2. Automatically run Courier Ratio / Fraud Check if not already checked for this phone
    if (courierCheckState.phone === normPhone && (courierCheckState.status === 'completed' || courierCheckState.status === 'loading')) {
      return;
    }

    const timer = setTimeout(() => {
      runCourierRatioCheck(normPhone);
    }, 250);

    return () => clearTimeout(timer);
  }, [phone, isOpen, orders]);

  if (!isOpen) return null;

  // Real-time Financial Calculations
  const subtotal = selectedItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const grandTotal = Math.max(0, subtotal + Number(deliveryCharge || 0) - Number(discount || 0));

  // Weight check for free bonus
  const totalLooseKg = selectedItems
    .filter((it) => !it.isCombo && it.unit === 'কেজি')
    .reduce((acc, it) => acc + it.quantity, 0);
  const eligibleForFreeBonus = totalLooseKg >= FREE_BONUS_MIN_KG;

  // Add Item from Catalog
  const handleAddItem = () => {
    if (catalogSelectId === '__CUSTOM__') {
      setItemAddMode('custom');
      return;
    }
    const opt = orderOptions.find((o) => o.id === catalogSelectId);
    if (!opt) return;

    setSelectedItems((prev) => {
      const existingIdx = prev.findIndex((it) => it.id === opt.id);
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx].quantity += 1;
        return copy;
      }
      return [
        ...prev,
        {
          id: opt.id,
          name: opt.label,
          price: opt.price,
          quantity: 1,
          unit: opt.unit || 'কেজি',
          isCombo: !!opt.isCombo,
          isCustom: false
        }
      ];
    });

    // Auto set free delivery if combo added
    if (opt.freeDelivery) {
      setDeliveryCharge(0);
    }
  };

  // Add Custom / Manual Product (even if not in catalog)
  const handleAddCustomItem = () => {
    const trimmedName = customName.trim();
    if (!trimmedName) {
      setErrors((prev) => ({ ...prev, customName: 'পণ্যের নাম লিখুন' }));
      return;
    }
    const parsedPrice = Number(customPrice);
    if (customPrice === '' || isNaN(parsedPrice) || parsedPrice < 0) {
      setErrors((prev) => ({ ...prev, customPrice: 'সঠিক মূল্য দিন (৳)' }));
      return;
    }
    const parsedQty = Math.max(1, parseInt(customQty, 10) || 1);

    setSelectedItems((prev) => [
      ...prev,
      {
        id: 'custom-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
        name: trimmedName,
        price: parsedPrice,
        quantity: parsedQty,
        unit: customUnit.trim() || 'পিস',
        isCombo: false,
        isCustom: true
      }
    ]);

    setCustomName('');
    setCustomPrice('');
    setCustomQty(1);
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.customName;
      delete copy.customPrice;
      delete copy.items;
      return copy;
    });
  };

  // Quantity adjustments
  const handleUpdateQty = (index, delta) => {
    setSelectedItems((prev) => {
      const copy = [...prev];
      const newQty = copy[index].quantity + delta;
      if (newQty <= 0) {
        return prev.filter((_, idx) => idx !== index);
      }
      copy[index].quantity = newQty;
      return copy;
    });
  };

  const handleSetQty = (index, val) => {
    const qty = Math.max(1, parseInt(val, 10) || 1);
    setSelectedItems((prev) => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index].quantity = qty;
      }
      return copy;
    });
  };

  const handleUpdatePrice = (index, val) => {
    const price = Number(val);
    setSelectedItems((prev) => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index].price = isNaN(price) || price < 0 ? 0 : price;
      }
      return copy;
    });
  };

  const handleUpdateName = (index, val) => {
    setSelectedItems((prev) => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index].name = val;
      }
      return copy;
    });
  };

  const handleRemoveItem = (index) => {
    setSelectedItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Quick Delivery Presets
  const setDeliveryPreset = (val, areaType) => {
    setDeliveryCharge(val);
    if (areaType) setArea(areaType);
  };

  // Validation
  const validateForm = () => {
    const errs = {};
    if (!customerName.trim()) {
      errs.customerName = 'গ্রাহকের নাম আবশ্যক';
    }
    const normPhone = normalizeBdPhone(phone);
    if (!isValidBdPhone(normPhone)) {
      errs.phone = 'সঠিক ১১ ডিজিটের ফোন নম্বর দিন (যেমন: 017XXXXXXXX)';
    }
    if (!address.trim() || address.trim().length < 6) {
      errs.address = 'পূর্ণ ঠিকানা লিখুন (যেমন: বাড়ি, রোড, এলাকা, জেলা)';
    }
    if (selectedItems.length === 0) {
      errs.items = 'অন্তত একটি পণ্য নির্বাচন করুন';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Handle Submit Order
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const normPhone = normalizeBdPhone(phone);
      const timestampId = 'MG-M' + Date.now().toString(36).toUpperCase();

      // Format items payload
      const itemsPayload = selectedItems.map((it) => ({
        id: it.id,
        name: it.name,
        price: it.price,
        quantity: it.quantity,
        unit: it.unit,
        total: it.price * it.quantity
      }));

      // Add free bonus if eligible
      if (eligibleForFreeBonus) {
        itemsPayload.push({
          id: 'free-jhola-500g',
          name: FREE_BONUS_ITEM_NAME,
          price: 0,
          quantity: 1,
          unit: 'প্যাক',
          total: 0
        });
      }

      // Summary product text
      const summaryText = itemsPayload
        .map((it) => `${it.name} (${it.quantity} ${it.unit})`)
        .join(' + ');

      const totalItemsCount = selectedItems.reduce((acc, it) => acc + it.quantity, 0);

      const payload = {
        order_id: timestampId,
        name: customerName.trim(),
        phone: normPhone,
        address: address.trim(),
        area: area,
        package_id: selectedItems[0]?.id || 'custom',
        product_name: summaryText,
        package_name: summaryText,
        quantity: totalItemsCount,
        unit: selectedItems[0]?.unit || 'প্যাক',
        unit_price: selectedItems[0]?.price || subtotal,
        subtotal: subtotal,
        delivery_charge: Number(deliveryCharge || 0),
        delivery_fee: Number(deliveryCharge || 0),
        discount: Number(discount || 0),
        total_price: grandTotal,
        payment_method: paymentMethod,
        items: itemsPayload,
        status: orderStatus,
        notes: [
          orderSource ? `[Source: ${orderSource.toUpperCase()}]` : '',
          notes.trim()
        ]
          .filter(Boolean)
          .join(' · ')
      };

      const result = await createManualOrder(payload);
      if (result.success) {
        const orderData = result.order || payload;
        setCreatedOrder(orderData);
        if (onOrderCreated) {
          onOrderCreated(orderData);
        }
      }
    } catch (err) {
      console.error('Error creating manual order:', err);
      showToast('অর্ডার তৈরি করতে ত্রুটি হয়েছে', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Reset form for next order
  const handleResetForNew = () => {
    setPhone('');
    setCustomerName('');
    setAddress('');
    setNotes('');
    setCreatedOrder(null);
    setErrors({});
    setRepeatCustomerOrders([]);
    lastAutoFilledPhoneRef.current = '';
    latestLookupPhoneRef.current = '';
    setCourierCheckState({
      status: 'idle',
      data: null,
      error: null,
      phone: '',
      source: 'BD Courier'
    });
  };

  // Copy standard courier text
  const handleCopyCourierText = () => {
    if (!createdOrder) return;
    const txt = formatOrderCourierText(createdOrder);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt);
    }
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Render Automatic Inline Courier Ratio & Fraud Rate Card directly under Phone Number
  const renderInlineCourierRatio = () => {
    const normPhone = normalizeBdPhone(phone);
    if (!isValidBdPhone(normPhone)) return null;

    if (courierCheckState.status === 'loading') {
      return (
        <div className="com-courier-ratio-card new">
          <div className="com-ratio-top-row">
            <div className="com-ratio-title-group">
              <RotateCw size={14} className="com-spin" color="#059669" />
              <span>কুরিয়ার সাকসেস ও ফ্রড রেশিও চেক হচ্ছে ({normPhone})...</span>
            </div>
          </div>
        </div>
      );
    }

    if (courierCheckState.status === 'error') {
      return (
        <div className="com-courier-ratio-card medium">
          <div className="com-ratio-top-row">
            <div className="com-ratio-title-group" style={{ color: '#b45309' }}>
              <AlertTriangle size={14} />
              <span>{courierCheckState.error || 'কুরিয়ার রেশিও পাওয়া যায়নি'}</span>
            </div>
            <button
              type="button"
              className="com-ratio-refresh-btn"
              onClick={() => runCourierRatioCheck(normPhone)}
            >
              <RotateCw size={11} />
              <span>আবার চেক করুন</span>
            </button>
          </div>
        </div>
      );
    }

    if (courierCheckState.status === 'completed' && courierCheckState.data) {
      const d = courierCheckState.data;
      const summary = d.summary || {};
      const rawCouriers = d.couriers || {};

      const total = Number(summary.total_parcel || 0);
      const success = Number(summary.success_parcel || 0);
      const cancelled = Number(summary.cancelled_parcel || Math.max(0, total - success));

      const hasAnyRateOnlyCourier = Object.values(rawCouriers).some(
        (c) => c && (c.total_parcel > 0 || (c.rate_only && Number(c.success_ratio) > 0))
      );
      const hasHistory = total > 0 || hasAnyRateOnlyCourier;

      const rawSuccessRatio =
        summary.success_ratio !== undefined && summary.success_ratio !== null
          ? Number(summary.success_ratio)
          : total > 0
          ? (success / total) * 100
          : 0;
      const successRate = hasHistory ? Number(rawSuccessRatio.toFixed(1).replace(/\.0$/, '')) : 0;
      const fraudRate = hasHistory ? Number(Math.max(0, 100 - rawSuccessRatio).toFixed(1).replace(/\.0$/, '')) : 0;

      let riskTone = 'new';
      let riskLabel = '🆕 NEW CUSTOMER (0 PARCELS)';
      if (hasHistory) {
        if (successRate >= 80) {
          riskTone = 'safe';
          riskLabel = `✓ SAFE (${successRate}% DELIVERED)`;
        } else if (successRate >= 60) {
          riskTone = 'medium';
          riskLabel = `⚠ MEDIUM RISK (${fraudRate}% CANCELLED)`;
        } else {
          riskTone = 'high';
          riskLabel = `🚨 HIGH FRAUD RISK (${fraudRate}% CANCELLED)`;
        }
      }

      // Standard 6 couriers matching the BD Courier Breakdown table
      const COURIER_ORDER = [
        { key: 'pathao', label: 'Pathao' },
        { key: 'steadfast', label: 'SteadFast' },
        { key: 'courrierfast', label: 'Courrier Fast' },
        { key: 'redx', label: 'RedX' },
        { key: 'paperfly', label: 'Paperfly' },
        { key: 'carrybee', label: 'CarryBee' }
      ];

      const breakdownRows = COURIER_ORDER.map((item) => {
        const info = rawCouriers[item.key] || {};
        const cTotal = Number(info.total_parcel || 0);
        const cSucc = Number(info.success_parcel || 0);
        const cCanc = Number(info.cancelled_parcel || 0);
        const isRateOnly = Boolean(info.rate_only) && cTotal === 0;
        const cRatio =
          info.success_ratio !== undefined && info.success_ratio !== null
            ? Number(Number(info.success_ratio).toFixed(1).replace(/\.0$/, ''))
            : cTotal > 0
            ? Number(((cSucc / cTotal) * 100).toFixed(1).replace(/\.0$/, ''))
            : 0;
        const hasRate = cTotal > 0 || (isRateOnly && cRatio > 0);

        return {
          key: item.key,
          name: info.name || item.label,
          total: cTotal,
          success: cSucc,
          cancelled: cCanc,
          rateOnly: isRateOnly,
          parcelRange: info.parcel_range || null,
          rateText: hasRate ? `${cRatio}%` : '—'
        };
      });

      const hasCourierBreakdown = Object.keys(rawCouriers).length > 0;
      const steadfastVol =
        d.steadfast_volume ||
        rawCouriers?.steadfast?.parcel_range ||
        d.volume_range ||
        (Number(rawCouriers?.steadfast?.total_parcel || 0) >= 10
          ? '10+'
          : Number(rawCouriers?.steadfast?.total_parcel || 0) > 0
          ? String(rawCouriers.steadfast.total_parcel)
          : '0');
      const totalReportsCount = Number(
        d.total_reports ?? (Array.isArray(d.reports) ? d.reports.length : 0)
      );

      return (
        <div className={`com-courier-ratio-card ${riskTone}`}>
          <div className="com-ratio-top-row">
            <div className="com-ratio-title-group">
              <ShieldCheck size={14} />
              <span>Courier Ratio ({courierCheckState.source || 'BD Courier'})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className={`com-ratio-risk-badge ${riskTone}`}>{riskLabel}</span>
              <button
                type="button"
                className="com-ratio-refresh-btn"
                onClick={() => runCourierRatioCheck(normPhone, true)}
                title="Live re-check from BD Courier API"
              >
                <RotateCw size={11} />
              </button>
            </div>
          </div>

          {/* Visual Dual-Segment Progress Bar: Delivered % vs Cancelled % */}
          <div className="com-ratio-progress-wrap">
            <div className="com-ratio-progress-labels">
              <span className="com-ratio-succ-text">
                ✓ {hasHistory ? `${successRate}% Delivered` : '0% Delivered'}
              </span>
              <span className="com-ratio-fraud-text">
                ✕ {hasHistory ? `${fraudRate}% Cancelled` : '0% Cancelled'}
              </span>
            </div>
            <div className="com-ratio-progress-track">
              <div
                className="com-ratio-fill-success"
                style={{ width: `${hasHistory ? successRate : 0}%` }}
              />
              <div
                className="com-ratio-fill-fraud"
                style={{ width: `${hasHistory ? fraudRate : 0}%` }}
              />
            </div>
          </div>

          {/* 3-Column Parcel Summary + SteadFast Volume & Fraud Reports */}
          <div className="com-ratio-metrics-grid">
            <div className="com-ratio-metric-box">
              <span className="com-ratio-metric-lbl">Total Orders</span>
              <span className="com-ratio-metric-val">{total}</span>
            </div>
            <div className="com-ratio-metric-box">
              <span className="com-ratio-metric-lbl">Delivered</span>
              <span className="com-ratio-metric-val succ">{success}</span>
            </div>
            <div className="com-ratio-metric-box">
              <span className="com-ratio-metric-lbl">Cancelled</span>
              <span className="com-ratio-metric-val fraud">{cancelled}</span>
            </div>
          </div>

          {/* SteadFast Parcel Volume & Fraud Reports Pills (matching BD Courier Dashboard) */}
          <div className="com-courier-chip-list">
            <span className="com-courier-chip has-parcels">
              <span className="c-name">📦 SteadFast Volume:</span>
              <span className="c-score" style={{ color: '#059669' }}>{steadfastVol}</span>
            </span>
            <span
              className="com-courier-chip"
              style={
                totalReportsCount > 0
                  ? { background: '#ffe4e6', borderColor: '#fda4af', color: '#be123c' }
                  : {}
              }
            >
              <span className="c-name">🛡 Fraud Reports:</span>
              <span
                className="c-score"
                style={{ color: totalReportsCount > 0 ? '#e11d48' : '#0f172a' }}
              >
                {totalReportsCount}
              </span>
            </span>
          </div>

          {/* Full Courier Breakdown Table (matching BD Courier screenshot) */}
          {hasCourierBreakdown && (
            <div className="com-breakdown-table-wrap">
              <table className="com-breakdown-table">
                <thead>
                  <tr>
                    <th>COURIER</th>
                    <th className="num">TOTAL</th>
                    <th className="num">SUCCESS</th>
                    <th className="num">CANCEL</th>
                    <th className="num">RATE</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdownRows.map((row) => (
                    <tr key={row.key} className={row.total > 0 || row.rateOnly ? 'active-row' : 'zero-row'}>
                      <td className="c-col-name">
                        {row.name}
                        {row.rateOnly && row.parcelRange ? (
                          <span className="com-vol-tag">Vol {row.parcelRange}</span>
                        ) : null}
                      </td>
                      <td className="num">{row.total}</td>
                      <td className="num succ">{row.success}</td>
                      <td className="num fraud">{row.cancelled}</td>
                      <td className="num rate">{row.rateText}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td className="num">{total}</td>
                    <td className="num succ">{success}</td>
                    <td className="num fraud">{cancelled}</td>
                    <td className="num rate">{hasHistory ? `${successRate}%` : '—'}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Fraud Reports Categories Breakdown (when available) */}
          {totalReportsCount > 0 && d.fraud_categories && (
            <div className="com-courier-chip-list">
              {Object.entries(d.fraud_categories)
                .filter(([, count]) => Number(count) > 0)
                .map(([catKey, count]) => (
                  <span key={catKey} className="com-courier-chip">
                    <span className="c-name">{catKey.replace(/_/g, ' ')}:</span>
                    <span className="c-score" style={{ color: '#e11d48' }}>
                      {count}
                    </span>
                  </span>
                ))}
            </div>
          )}

          {/* Returning Store Customer Banner */}
          {repeatCustomerOrders.length > 0 && (
            <div className="com-repeat-customer-bar">
              <span>
                🔄 আমাদের স্টোরে পূর্বে {repeatCustomerOrders.length}টি অর্ডার করেছেন ({repeatCustomerOrders[0]?.name})
              </span>
              <button
                type="button"
                className="com-repeat-fill-btn"
                onClick={() => {
                  const latest = repeatCustomerOrders[0];
                  if (latest?.name) setCustomerName(latest.name);
                  if (latest?.address) setAddress(latest.address);
                }}
              >
                নাম ও ঠিকানা বসান
              </button>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="com-backdrop" role="dialog" aria-modal="true">
      <div className="com-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="com-header">
          <div className="com-header-left">
            <div className="com-header-icon">
              <ShoppingBag size={20} />
            </div>
            <div>
              <h3 className="com-title">Create New Order (নতুন অর্ডার তৈরি)</h3>
              <p className="com-subtitle">
                ম্যানুয়াল অর্ডার এন্ট্রি · ফোন, হোয়াটসঅ্যাপ বা ইনবক্স থেকে
              </p>
            </div>
          </div>
          <button type="button" className="com-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* If Order was just created: Render Success View */}
        {createdOrder ? (
          <div className="com-success-view">
            <div className="com-success-check">✓</div>
            <h4 className="com-success-title">অর্ডার সফলভাবে তৈরি হয়েছে!</h4>
            <div>
              <span className="com-success-id">#{createdOrder.order_id}</span>
            </div>
            <p style={{ margin: 0, color: '#475569', fontSize: '13.5px' }}>
              গ্রাহক: <b>{createdOrder.name}</b> · মোবাইল: <b>{createdOrder.phone}</b> · সর্বমোট: <b>৳{createdOrder.total_price}</b>
            </p>

            <div className="com-success-actions">
              {onOpenPrint && (
                <button
                  type="button"
                  className="com-btn com-btn-submit"
                  onClick={() => {
                    onClose();
                    onOpenPrint(createdOrder);
                  }}
                  style={{ background: '#0f172a', borderColor: '#0f172a' }}
                >
                  <Printer size={16} />
                  <span>Print Thermal Label (স্টিকার প্রিন্ট)</span>
                </button>
              )}

              <button
                type="button"
                className="com-btn com-btn-cancel"
                onClick={handleCopyCourierText}
              >
                {copiedText ? <Check size={16} color="#059669" /> : <Copy size={16} />}
                <span>{copiedText ? 'Copied to Clipboard!' : 'Copy Courier Text (কুরিয়ার টেক্সট)'}</span>
              </button>

              <button
                type="button"
                className="com-btn com-btn-submit"
                onClick={handleResetForNew}
              >
                <Plus size={16} />
                <span>Create Another Order (আরেকটি অর্ডার)</span>
              </button>
            </div>
          </div>
        ) : (
          /* Form Content: Two-Column Responsive Layout */
          <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
            <div className="com-body">
              {/* LEFT COLUMN: Customer & Shipping Details */}
              <div className="com-col">
                <div className="com-section-title">
                  <User size={15} />
                  <span>Customer & Delivery (গ্রাহকের তথ্য)</span>
                </div>

                {/* 1. FIRST FIELD: Customer Phone Number + Automatic Courier Ratio Check */}
                <div className="com-form-group">
                  <label className="com-label">
                    <span>Phone Number (মোবাইল নম্বর) <span className="req">*</span></span>
                    {phone && (
                      <span
                        style={{
                          fontSize: '11px',
                          color: isValidBdPhone(phone) ? '#059669' : '#64748b',
                          fontWeight: 700
                        }}
                      >
                        {normalizeBdPhone(phone)}
                      </span>
                    )}
                  </label>
                  <input
                    type="tel"
                    className={`com-input ${errors.phone ? 'error' : ''}`}
                    placeholder="01XXXXXXXXX (নম্বর লিখলেই অটো কুরিয়ার রেশিও চেক হবে)"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (errors.phone) {
                        setErrors((prev) => {
                          const c = { ...prev };
                          delete c.phone;
                          return c;
                        });
                      }
                    }}
                    autoFocus
                  />
                  {errors.phone && <span className="com-error-text">{errors.phone}</span>}

                  {/* Automatic Live Courier Success Rate & Fraud Rate Display */}
                  {renderInlineCourierRatio()}
                </div>

                {/* 2. SECOND FIELD: Customer Name */}
                <div className="com-form-group">
                  <label className="com-label">
                    <span>Customer Name (নাম) <span className="req">*</span></span>
                  </label>
                  <input
                    type="text"
                    className={`com-input ${errors.customerName ? 'error' : ''}`}
                    placeholder="গ্রাহকের পুরো নাম..."
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      if (errors.customerName) {
                        setErrors((prev) => {
                          const c = { ...prev };
                          delete c.customerName;
                          return c;
                        });
                      }
                    }}
                  />
                  {errors.customerName && (
                    <span className="com-error-text">{errors.customerName}</span>
                  )}
                </div>

                {/* 3. THIRD FIELD: Full Delivery Address */}
                <div className="com-form-group">
                  <label className="com-label">
                    <span>Full Address (পূর্ণ ঠিকানা) <span className="req">*</span></span>
                  </label>
                  <textarea
                    rows={2}
                    className={`com-textarea ${errors.address ? 'error' : ''}`}
                    placeholder="বাসা/হোল্ডিং, রোড, থানা, জেলা..."
                    value={address}
                    onChange={(e) => {
                      setAddress(e.target.value);
                      if (errors.address) {
                        setErrors((prev) => {
                          const c = { ...prev };
                          delete c.address;
                          return c;
                        });
                      }
                    }}
                  />
                  {errors.address && <span className="com-error-text">{errors.address}</span>}
                </div>

                {/* Delivery Area & Quick Charge Presets */}
                <div className="com-form-group">
                  <label className="com-label">
                    <span>Delivery Zone & Fee (ডেলিভারি এলাকা)</span>
                  </label>
                  <div className="com-pill-row">
                    <button
                      type="button"
                      className={`com-pill-btn ${area === 'inside_dhaka' && deliveryCharge === 80 ? 'active' : ''}`}
                      onClick={() => setDeliveryPreset(80, 'inside_dhaka')}
                    >
                      Inside Dhaka (৮০৳)
                    </button>
                    <button
                      type="button"
                      className={`com-pill-btn ${area === 'outside_dhaka' && deliveryCharge === 120 ? 'active' : ''}`}
                      onClick={() => setDeliveryPreset(120, 'outside_dhaka')}
                    >
                      Outside Dhaka (১২০৳)
                    </button>
                    <button
                      type="button"
                      className={`com-pill-btn ${deliveryCharge === 0 ? 'active' : ''}`}
                      onClick={() => setDeliveryPreset(0)}
                    >
                      Free Delivery (০৳)
                    </button>
                  </div>
                </div>

                {/* Order Source / Channel */}
                <div className="com-form-group">
                  <label className="com-label">
                    <span>Order Source (অর্ডারের মাধ্যম)</span>
                  </label>
                  <div className="com-pill-row">
                    {[
                      { id: 'phone', label: '📞 Phone Call' },
                      { id: 'whatsapp', label: '💬 WhatsApp' },
                      { id: 'messenger', label: '✉️ Messenger' },
                      { id: 'offline', label: '🏬 Offline' }
                    ].map((src) => (
                      <button
                        key={src.id}
                        type="button"
                        className={`com-pill-btn ${orderSource === src.id ? 'active' : ''}`}
                        onClick={() => setOrderSource(src.id)}
                      >
                        {src.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Internal / Delivery Notes */}
                <div className="com-form-group">
                  <label className="com-label">
                    <span>Admin Note (ঐচ্ছিক নোট)</span>
                  </label>
                  <input
                    type="text"
                    className="com-input"
                    placeholder="যেমন: ডেলিভারির পূর্বে কল করতে হবে..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              {/* RIGHT COLUMN: Products & Pricing */}
              <div className="com-col">
                <div className="com-section-title">
                  <ShoppingBag size={15} />
                  <span>Items & Pricing (পণ্য ও হিসাব)</span>
                </div>

                {/* Item Addition Section (Catalog Preset OR Custom Manual Entry) */}
                <div className="com-form-group">
                  <div className="com-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                    <span>Add Product (পণ্য যোগ করুন)</span>
                    <div className="com-mode-toggle-pills">
                      <button
                        type="button"
                        className={`com-mode-pill ${itemAddMode === 'catalog' ? 'active' : ''}`}
                        onClick={() => setItemAddMode('catalog')}
                      >
                        <ShoppingBag size={12} />
                        <span>ওয়েবসাইট তালিকা</span>
                      </button>
                      <button
                        type="button"
                        className={`com-mode-pill ${itemAddMode === 'custom' ? 'active' : ''}`}
                        onClick={() => setItemAddMode('custom')}
                      >
                        <Plus size={12} />
                        <span>কাস্টম / নতুন পণ্য</span>
                      </button>
                    </div>
                  </div>

                  {itemAddMode === 'catalog' ? (
                    <div className="com-add-item-wrap">
                      <select
                        className="com-select com-add-item-select"
                        value={catalogSelectId}
                        onChange={(e) => {
                          if (e.target.value === '__CUSTOM__') {
                            setItemAddMode('custom');
                          } else {
                            setCatalogSelectId(e.target.value);
                          }
                        }}
                      >
                        <optgroup label="ওয়েবসাইটের পণ্যসমূহ">
                          {orderOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label} — ৳{opt.price} {opt.isCombo ? '(কম্বো)' : `/${opt.unit}`}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="অন্যান্য">
                          <option value="__CUSTOM__">✍️ অন্য কোনো পণ্য ম্যানুয়ালি লিখুন...</option>
                        </optgroup>
                      </select>
                      <button type="button" className="com-add-btn" onClick={handleAddItem}>
                        <Plus size={16} />
                        <span>Add</span>
                      </button>
                    </div>
                  ) : (
                    <div className="com-custom-item-card">
                      <div className="com-custom-row-1">
                        <input
                          type="text"
                          className={`com-input ${errors.customName ? 'error' : ''}`}
                          placeholder="পণ্যের নাম লিখুন (যেমন: সুন্দরবনের মধু, খাঁটি সরিষার তেল...)"
                          value={customName}
                          onChange={(e) => {
                            setCustomName(e.target.value);
                            if (errors.customName) {
                              setErrors((prev) => {
                                const c = { ...prev };
                                delete c.customName;
                                return c;
                              });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCustomItem();
                            }
                          }}
                          autoFocus
                        />
                      </div>
                      {errors.customName && (
                        <span className="com-error-text">{errors.customName}</span>
                      )}

                      <div className="com-custom-row-2">
                        <div className="com-custom-field price">
                          <span className="com-input-prefix">৳</span>
                          <input
                            type="number"
                            min="0"
                            className={`com-input ${errors.customPrice ? 'error' : ''}`}
                            placeholder="দর (৳)"
                            value={customPrice}
                            onChange={(e) => {
                              setCustomPrice(e.target.value);
                              if (errors.customPrice) {
                                setErrors((prev) => {
                                  const c = { ...prev };
                                  delete c.customPrice;
                                  return c;
                                });
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddCustomItem();
                              }
                            }}
                          />
                        </div>

                        <div className="com-custom-field unit">
                          <select
                            className="com-select"
                            value={customUnit}
                            onChange={(e) => setCustomUnit(e.target.value)}
                          >
                            <option value="কেজি">কেজি</option>
                            <option value="প্যাকেজ">প্যাকেজ</option>
                            <option value="জার">জার</option>
                            <option value="পিস">পিস</option>
                            <option value="লিটার">লিটার</option>
                            <option value="বক্স">বক্স</option>
                            <option value="গ্রাম">গ্রাম</option>
                            <option value="সেট">সেট</option>
                          </select>
                        </div>

                        <div className="com-custom-field qty">
                          <input
                            type="number"
                            min="1"
                            className="com-input"
                            title="পরিমাণ"
                            placeholder="পরিমাণ"
                            value={customQty}
                            onChange={(e) => setCustomQty(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddCustomItem();
                              }
                            }}
                          />
                        </div>

                        <button
                          type="button"
                          className="com-add-btn com-custom-add-btn"
                          onClick={handleAddCustomItem}
                        >
                          <Plus size={16} />
                          <span>যোগ করুন</span>
                        </button>
                      </div>
                      {errors.customPrice && (
                        <span className="com-error-text">{errors.customPrice}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Selected Items List */}
                <div className="com-form-group">
                  <label className="com-label">
                    <span>Selected Items ({selectedItems.length})</span>
                    {eligibleForFreeBonus && (
                      <span style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>
                        🎁 ৫০০ গ্রাম ফ্রি ঝোলা গুড় এলিজিবল!
                      </span>
                    )}
                  </label>

                  <div className="com-items-list">
                    {selectedItems.length === 0 ? (
                      <div className="com-empty-items">কোনো পণ্য নির্বাচন করা হয়নি</div>
                    ) : (
                      selectedItems.map((item, idx) => (
                        <div key={`${item.id}-${idx}`} className="com-item-row">
                          <div className="com-item-details">
                            <div className="com-item-name-wrap">
                              {item.isCustom ? (
                                <input
                                  type="text"
                                  className="com-item-name-input"
                                  value={item.name}
                                  onChange={(e) => handleUpdateName(idx, e.target.value)}
                                  placeholder="পণ্যের নাম"
                                  title="পণ্যের নাম পরিবর্তন করতে পারবেন"
                                />
                              ) : (
                                <div className="com-item-name" title={item.name}>
                                  {item.name}
                                </div>
                              )}
                              {item.isCustom && (
                                <span className="com-custom-badge">কাস্টম</span>
                              )}
                            </div>

                            <div className="com-item-meta-editable">
                              <span className="com-meta-label">দর: ৳</span>
                              <input
                                type="number"
                                min="0"
                                className="com-item-price-input"
                                value={item.price}
                                onChange={(e) => handleUpdatePrice(idx, e.target.value)}
                                title="দর/একক মূল্য পরিবর্তন করুন"
                              />
                              <span className="com-item-unit-text">/{item.unit}</span>
                            </div>
                          </div>

                          <div className="com-item-qty-wrap">
                            <button
                              type="button"
                              className="com-qty-btn"
                              onClick={() => handleUpdateQty(idx, -1)}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleSetQty(idx, e.target.value)}
                              className="com-qty-input"
                            />
                            <button
                              type="button"
                              className="com-qty-btn"
                              onClick={() => handleUpdateQty(idx, 1)}
                            >
                              +
                            </button>
                          </div>

                          <div className="com-item-subtotal">
                            ৳{item.price * item.quantity}
                          </div>

                          <button
                            type="button"
                            className="com-item-del-btn"
                            onClick={() => handleRemoveItem(idx)}
                            title="Remove"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  {errors.items && <span className="com-error-text">{errors.items}</span>}
                </div>

                {/* Financial Summary */}
                <div className="com-calc-card">
                  <div className="com-calc-row">
                    <span>Subtotal (পণ্য মূল্য):</span>
                    <span className="val">৳{subtotal}</span>
                  </div>

                  <div className="com-calc-row">
                    <span>Delivery Charge (ডেলিভারি):</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>৳</span>
                      <input
                        type="number"
                        min="0"
                        className="com-input"
                        style={{ width: '70px', padding: '3px 6px', height: '28px', fontSize: '13px' }}
                        value={deliveryCharge}
                        onChange={(e) => setDeliveryCharge(Number(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div className="com-calc-row">
                    <span>Discount (ছাড়):</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>- ৳</span>
                      <input
                        type="number"
                        min="0"
                        className="com-input"
                        style={{ width: '70px', padding: '3px 6px', height: '28px', fontSize: '13px' }}
                        value={discount}
                        onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div className="com-calc-row total-row">
                    <span>Total Payable (সর্বমোট):</span>
                    <span className="val">৳{grandTotal}</span>
                  </div>
                </div>

                {/* Status & Payment Method */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="com-form-group">
                    <label className="com-label">
                      <span>Status</span>
                    </label>
                    <select
                      className="com-select"
                      value={orderStatus}
                      onChange={(e) => setOrderStatus(e.target.value)}
                    >
                      <option value="confirmed">Confirmed (কনফার্ম)</option>
                      <option value="pending">Pending (পেন্ডিং)</option>
                      <option value="processing">Processing</option>
                      <option value="shipped">Shipped</option>
                    </select>
                  </div>

                  <div className="com-form-group">
                    <label className="com-label">
                      <span>Payment</span>
                    </label>
                    <select
                      className="com-select"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="cod">Cash on Delivery (COD)</option>
                      <option value="bkash">bKash</option>
                      <option value="nagad">Nagad</option>
                      <option value="cash">Cash (নগদ)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="com-footer">
              <button type="button" className="com-btn com-btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="com-btn com-btn-submit"
                disabled={submitting}
              >
                {submitting ? 'Creating Order...' : 'Create Order (অর্ডার তৈরি করুন)'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
