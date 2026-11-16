import React, { useState, useId } from 'react';
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
  X,
  CreditCard,
  FileText
} from 'lucide-react';
import { useCms } from '../../context/CmsContext';
import { normalizeBdPhone, isValidBdPhone } from '../../lib/phoneNormalizer';
import { formatOrderCourierText } from '../../lib/orderHelper';
import { orderOptions, FREE_BONUS_MIN_KG, FREE_BONUS_ITEM_NAME } from '../../data';
import './createOrderModal.css';

export default function CreateOrderModal({
  isOpen,
  onClose,
  onOrderCreated,
  onOpenPrint
}) {
  const { createManualOrder, showToast } = useCms();

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('inside_dhaka'); // 'inside_dhaka' | 'outside_dhaka'
  const [orderSource, setOrderSource] = useState('phone'); // 'phone' | 'whatsapp' | 'messenger' | 'offline'
  const [orderStatus, setOrderStatus] = useState('confirmed'); // default to confirmed for manual orders
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [notes, setNotes] = useState('');

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

  // Submission & Post-Creation States
  const [submitting, setSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);
  const [copiedText, setCopiedText] = useState(false);
  const [errors, setErrors] = useState({});

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
          isCombo: !!opt.isCombo
        }
      ];
    });

    // Auto set free delivery if combo added
    if (opt.freeDelivery) {
      setDeliveryCharge(0);
    }
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
    setCustomerName('');
    setPhone('');
    setAddress('');
    setNotes('');
    setCreatedOrder(null);
    setErrors({});
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

  return (
    <div className="com-backdrop" onClick={onClose} role="dialog" aria-modal="true">
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

                {/* Customer Name */}
                <div className="com-form-group">
                  <label className="com-label">
                    <span>Customer Name (নাম) <span className="req">*</span></span>
                  </label>
                  <input
                    type="text"
                    className={`com-input ${errors.customerName ? 'error' : ''}`}
                    placeholder="গ্রাহকের পুরো নাম..."
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    autoFocus
                  />
                  {errors.customerName && (
                    <span className="com-error-text">{errors.customerName}</span>
                  )}
                </div>

                {/* Customer Phone */}
                <div className="com-form-group">
                  <label className="com-label">
                    <span>Phone Number (মোবাইল নম্বর) <span className="req">*</span></span>
                    {phone && (
                      <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>
                        {normalizeBdPhone(phone)}
                      </span>
                    )}
                  </label>
                  <input
                    type="tel"
                    className={`com-input ${errors.phone ? 'error' : ''}`}
                    placeholder="01XXXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  {errors.phone && <span className="com-error-text">{errors.phone}</span>}
                </div>

                {/* Delivery Address */}
                <div className="com-form-group">
                  <label className="com-label">
                    <span>Full Address (পূর্ণ ঠিকানা) <span className="req">*</span></span>
                  </label>
                  <textarea
                    rows={2}
                    className={`com-textarea ${errors.address ? 'error' : ''}`}
                    placeholder="বাসা/হোল্ডিং, রোড, থানা, জেলা..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
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

                {/* Item Selector */}
                <div className="com-form-group">
                  <label className="com-label">
                    <span>Select Product to Add (পণ্য যোগ করুন)</span>
                  </label>
                  <div className="com-add-item-wrap">
                    <select
                      className="com-select com-add-item-select"
                      value={catalogSelectId}
                      onChange={(e) => setCatalogSelectId(e.target.value)}
                    >
                      {orderOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label} — ৳{opt.price} {opt.isCombo ? '(কম্বো)' : `/${opt.unit}`}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="com-add-btn" onClick={handleAddItem}>
                      <Plus size={16} />
                      <span>Add</span>
                    </button>
                  </div>
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
                            <div className="com-item-name">{item.name}</div>
                            <div className="com-item-meta">
                              ৳{item.price} / {item.unit}
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
                              type="text"
                              readOnly
                              value={item.quantity}
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
