import React, { useEffect, useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Phone, Check, Package, ArrowLeft, Copy } from 'lucide-react';
import { useCms } from '../context/CmsContext';
import { formatOrderCourierText } from '../lib/orderHelper';
import { trackPurchase, trackMessageAction } from '../lib/tracking';

export default function OrderSuccessPage({ order, onReturnHome }) {
  const { siteSettings } = useCms();
  const [copied, setCopied] = useState(false);
  const trackedRef = useRef(false);

  // Trigger celebration confetti & fire Purchase tracking on mount exactly once
  useEffect(() => {
    try {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.5 }
      });
    } catch (e) {
      console.warn('Confetti notice:', e);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Ensure dataLayer & pixels fire purchase event exactly once per order
    if (order && !trackedRef.current) {
      trackedRef.current = true;
      trackPurchase({ order, siteSettings });
    }
  }, [order, siteSettings]);

  // Clean date formatting
  const formattedDate = new Intl.DateTimeFormat('bn-BD', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date());

  const displayOrderId = order?.order_id || 'MG-' + Date.now().toString(36).toUpperCase();
  const customerName = order?.name || 'সম্মানিত গ্রাহক';
  const customerPhone = order?.phone || '01XXXXXXXXX';
  const customerAddress = order?.address || 'বাংলাদেশ';
  const productName = order?.product_name || order?.package_name || 'খাঁটি খেজুরের গুড়';
  const quantity = order?.quantity || 1;
  const unit = order?.unit || 'কেজি';
  const totalPrice = order?.total_price || order?.total || '0';
  const formattedPrice = Number(totalPrice).toLocaleString('en-IN');
  const ipAddress = order?.ip_address || sessionStorage.getItem('mg_client_ip') || 'unknown';

  const handleCopyOrder = () => {
    const formattedText = formatOrderCourierText(order || {
      name: customerName,
      address: customerAddress,
      phone: customerPhone,
      product_name: productName,
      total_price: totalPrice,
      quantity
    });

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(formattedText);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = formattedText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="success-page-shell">
      <div className="success-card-wrapper">
        <div className="success-receipt-card">
          {/* Top Warm Banner with Celebration Badge */}
          <div className="success-top-banner">
            <div className="success-check-badge">
              <Check size={34} strokeWidth={3.5} color="#ffffff" />
            </div>

            <h1 className="success-title">আপনার অর্ডারটি সফল হয়েছে!</h1>
            <p className="success-subtitle">
              ধন্যবাদ ম্যাংগো গার্ডেনের সাথে থাকার জন্য। আপনার খাঁটি খেজুরের গুড়ের অর্ডারটি কনফার্মের তালিকায় যুক্ত হয়েছে। (📦 ১৫ নভেম্বর থেকে ডেলিভারি শুরু, ইনশাআল্লাহ)
            </p>
          </div>

          {/* Ticket Perforated Cut Line */}
          <div className="success-cut-line"></div>

          {/* White Invoice Section */}
          <div className="success-body">
            <div className="success-sec-heading">
              <span className="success-box-emoji">📦</span>
              <span>অর্ডারের বিস্তারিত ইনভয়েস</span>
            </div>

            <div className="success-divider"></div>

            {/* Receipt Table Rows */}
            <div className="success-rows-list">
              <div className="success-row">
                <span className="success-lbl">অর্ডার নম্বর (ID)</span>
                <span className="success-val" style={{ color: '#ea580c' }}>#{displayOrderId}</span>
              </div>

              <div className="success-row">
                <span className="success-lbl">তারিখ</span>
                <span className="success-val">{formattedDate}</span>
              </div>

              <div className="success-row" style={{ alignItems: 'flex-start' }}>
                <span className="success-lbl">পণ্য ও প্যাকেজ</span>
                <span className="success-val" style={{ textAlign: 'right', maxWidth: '65%' }}>
                  {productName.includes('(') ? productName : `${productName} (${quantity} ${unit})`}
                </span>
              </div>

              <div className="success-row">
                <span className="success-lbl">গ্রাহকের নাম</span>
                <span className="success-val">{customerName}</span>
              </div>

              <div className="success-row">
                <span className="success-lbl">মোবাইল নম্বর</span>
                <span className="success-val">{customerPhone}</span>
              </div>

              <div className="success-row">
                <span className="success-lbl">ডেলিভারি ঠিকানা</span>
                <span className="success-val" style={{ maxWidth: '65%', textAlign: 'right' }}>
                  {customerAddress}
                </span>
              </div>

              <div className="success-row">
                <span className="success-lbl">পেমেন্ট মেথড</span>
                <span className="success-val">ক্যাশ অন ডেলিভারি (হাতে পেয়ে টাকা)</span>
              </div>

              {ipAddress && ipAddress !== 'unknown' && (
                <div className="success-row" style={{ opacity: 0.7, fontSize: '12px' }}>
                  <span className="success-lbl">অর্ডার ট্র্যাকিং আইপি</span>
                  <span className="success-val" style={{ fontWeight: 500, fontFamily: 'monospace' }}>{ipAddress}</span>
                </div>
              )}
            </div>

            {/* Total Highlight Row */}
            <div className="success-total-row">
              <span className="success-total-lbl">সর্বমোট প্রদেয় টাকা</span>
              <span className="success-total-val">৳ {formattedPrice}</span>
            </div>

            {/* Important Notice Box */}
            <div className="success-notice-box">
              <div className="success-notice-icon">
                <Phone size={22} className="success-phone-icon" />
              </div>
              <div className="success-notice-text">
                <strong>জরুরি বিজ্ঞপ্তি:</strong> পার্সেল পাঠানোর পূর্বে আমাদের প্রতিনিধি আপনার নম্বরে <strong>কল করে ঠিকানা কনফার্ম করবেন।</strong>
              </div>
            </div>

            {/* Direct WhatsApp Order CTA Button */}
            <a
              href={`https://wa.me/8801318007554?text=${encodeURIComponent(`হ্যালো ম্যাংগো গার্ডেন, আমার অর্ডার নম্বর #${displayOrderId}। আমি আরো কিছু পণ্য অর্ডার করতে চাচ্ছি।`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="success-whatsapp-btn"
              onClick={() => trackMessageAction({ channel: 'whatsapp', placement: 'success_page' })}
              title="সরাসরি হোয়াটসঅ্যাপে যোগাযোগ করুন: 01318-007554"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="success-whatsapp-icon">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <div className="success-whatsapp-text-wrap">
                <span className="success-whatsapp-primary">আরো অর্ডার করতে সরাসরি হোয়াটসঅ্যাপে যোগাযোগ করুন</span>
                <span className="success-whatsapp-num">WhatsApp: 01318-007554</span>
              </div>
            </a>

            {/* One-click Copy Order Button */}
            <button
              type="button"
              className="success-copy-btn"
              onClick={handleCopyOrder}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span>{copied ? '✓ সম্পূর্ণ বিবরণ কপি হয়েছে!' : '📋 এক ক্লিকে অর্ডার কপি করুন'}</span>
            </button>

            {/* Return to Home CTA Button */}
            <button
              type="button"
              className="success-home-btn"
              onClick={onReturnHome}
            >
              <ArrowLeft size={18} style={{ marginRight: '6px' }} />
              <span>হোম পেজে ফিরে যান</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
