import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(useGSAP, ScrollTrigger)
import {
  Truck,
  Gift,
  Phone,
  Play,
  Pause,
  X,
  ArrowRight,
  Check,
  ShoppingBag,
  ShieldCheck,
  ChevronUp
} from 'lucide-react'
import {
  BRAND_IMAGES,
  DELIVERY_CHARGE,
  DELIVERY_START_NOTICE,
  FREE_BONUS_MIN_KG,
  FREE_BONUS_ITEM_NAME,
  MAX_LOOSE_KG_PER_ITEM,
  MAX_COMBO_PACKS,
  WHATSAPP_DISPLAY,
  WHATSAPP_E164,
  combos,
  gurPrices,
  orderOptions
} from './data.js'
import { submitOrder } from './supabase.js'
import { CmsProvider, useCms } from './context/CmsContext.jsx'
import AdminApp from './admin/AdminApp.jsx'
import OrderSuccessPage from './pages/OrderSuccessPage.jsx'
import CustomerReviews from './components/CustomerReviews.jsx'
import {
  HeroSunburst,
  MenuHeritageIllustration,
  DeliveryHeritageIllustration,
  SeasonStampBadge,
  SectionDivider,
  HeritageShopSeal,
  WavyTopEdge
} from './components/HeritageSvgs.jsx'
import { fetchClientIp, trackInitiateCheckout, trackMessageAction } from './lib/tracking.js'
import { normalizeBdPhone, isValidBdPhone } from './lib/phoneNormalizer.js'

/* ---------- Helpers & Bengali Numerals ---------- */
const bnDigits = '০১২৩৪৫৬৭৮৯'
const toBn = (n) => String(n).replace(/\d/g, (d) => bnDigits[d])
const taka = (n) => toBn(Number(n).toLocaleString('en-IN'))

const scrollToSection = (id) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

function resolveWhatsAppConfig(siteSettings) {
  const rawDigits = String(siteSettings?.whatsapp_number || '').replace(/[^0-9]/g, '')
  const isPlaceholder = !rawDigits || /^880?1700000000$/.test(rawDigits) || /000000/.test(rawDigits)
  if (isPlaceholder) {
    return { waE164: WHATSAPP_E164, waDisplay: WHATSAPP_DISPLAY }
  }
  const waE164 = rawDigits.startsWith('880')
    ? rawDigits
    : rawDigits.startsWith('0')
    ? `88${rawDigits}`
    : rawDigits
  const localDigits = waE164.startsWith('880') ? `0${waE164.slice(3)}` : waE164
  const waDisplay =
    localDigits.length === 11 ? `${localDigits.slice(0, 5)}-${localDigits.slice(5)}` : WHATSAPP_DISPLAY
  return { waE164, waDisplay }
}

/* ==========================================================================
   1. HERITAGE HEADER & TOP NOTICE STRIP
   ========================================================================== */
function HeritageHeader({ totalItems, grandTotal, onOpenCheckout, siteSettings }) {
  const { waE164, waDisplay } = resolveWhatsAppConfig(siteSettings)

  return (
    <>
      <div className="top-notice-strip">
        📦 {DELIVERY_START_NOTICE} · সারা বাংলাদেশে ক্যাশ অন ডেলিভারি
      </div>
      <header className="heritage-header">
        <div className="container heritage-header-inner">
          <a href="#top" className="header-brand" aria-label="ম্যাংগো গার্ডেন হোম পেজ">
            <div className="brand-emblem-disc">
              <img src={BRAND_IMAGES.logo} alt="ম্যাংগো গার্ডেন লোগো" />
            </div>
            <div className="header-brand-text">
              <span className="header-brand-title">ম্যাংগো গার্ডেন</span>
              <span className="header-brand-subtitle">শীতের খাঁটি খেজুরের গুড়</span>
            </div>
          </a>

          <div className="header-right-actions">
            <a
              href={`tel:${waE164.startsWith('88') ? waE164.slice(2) : waE164}`}
              className="header-phone-btn"
              aria-label={`কল করুন: ${waDisplay}`}
            >
              <Phone size={14} />
              <span>কল করুন</span>
            </a>
            <button
              type="button"
              className="header-order-pill"
              onClick={() => (onOpenCheckout ? onOpenCheckout() : scrollToSection('order'))}
            >
              <ShoppingBag size={14} />
              <span>অর্ডার {totalItems > 0 ? `(${toBn(totalItems)})` : ''}</span>
            </button>
          </div>
        </div>
      </header>
    </>
  )
}

/* ==========================================================================
   2. SECTION 1: HERO (§4)
   ========================================================================== */
function HeroSection({ onPickAndOrder }) {
  const heroRef = useRef(null)

  useGSAP(() => {
    const mm = gsap.matchMedia()

    mm.add({
      isReduced: '(prefers-reduced-motion: reduce)',
      all: '(min-width: 0px)'
    }, (context) => {
      const { isReduced } = context.conditions

      if (isReduced) {
        gsap.set(
          '.hero-brand-emblem, .hero-intro-line, .hero-title-line, .hero-visual-card, .stamp-badge, .hero-secondary-badge, .hero-subject-img, .hero-bar-info, .hero-bottom-bar .btn-primary',
          {
            opacity: 1,
            y: 0,
            scale: 1,
            clearProps: 'all'
          }
        )
        return
      }

      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })

      // 1. Emblem entrance: gentle scale + fade
      tl.from('.hero-brand-emblem', {
        scale: 0.65,
        opacity: 0,
        duration: 0.5,
        ease: 'back.out(1.8)'
      })

      // 2. Intro lines fade up
      tl.from('.hero-intro-line', {
        y: 12,
        opacity: 0,
        duration: 0.4,
        stagger: 0.08
      }, '-=0.25')

      // 3. Headline words/lines fade up with clean Bengali typography
      tl.from('.hero-title-line', {
        y: 22,
        opacity: 0,
        duration: 0.55,
        stagger: 0.12,
        ease: 'power2.out'
      }, '-=0.2')

      // 4. Hero Visual Card reveal
      tl.from('.hero-visual-card', {
        y: 26,
        opacity: 0,
        scale: 0.97,
        duration: 0.6,
        ease: 'power3.out'
      }, '-=0.3')

      // 5. Hero Subject photo rise
      tl.from('.hero-subject-img', {
        y: 35,
        opacity: 0,
        duration: 0.7,
        ease: 'power2.out'
      }, '-=0.4')

      // 6. Season Stamp "stamp-in" feel (scale 1.35 -> 1 with rotation)
      tl.from('.stamp-badge', {
        scale: 1.35,
        rotation: -18,
        opacity: 0,
        duration: 0.45,
        ease: 'back.out(2)'
      }, '-=0.35')

      // 7. Secondary circular badge pop in
      tl.from('.hero-secondary-badge', {
        scale: 0,
        opacity: 0,
        duration: 0.4,
        ease: 'back.out(2.2)'
      }, '-=0.3')

      // 8. Bottom bar items
      tl.from('.hero-bar-info, .hero-bottom-bar .btn-primary', {
        y: 10,
        opacity: 0,
        duration: 0.35,
        stagger: 0.08
      }, '-=0.2')

      // 9. Continuous slow sunburst ambient rotation
      gsap.to('.hero-sunburst-bg', {
        rotation: 360,
        duration: 65,
        repeat: -1,
        ease: 'none',
        transformOrigin: 'center center'
      })

      // 10. Subtle floating motion for secondary badge
      gsap.to('.hero-secondary-badge', {
        y: -5,
        duration: 2.4,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      })
    })
  }, { scope: heroRef })

  return (
    <section className="hero-section" id="top" ref={heroRef}>
      <div className="container">
        {/* Emblem Logo */}
        <div className="hero-brand-emblem" aria-hidden="true">
          <img src={BRAND_IMAGES.logo} alt="ম্যাংগো গার্ডেন" />
        </div>

        {/* Small Intro Line */}
        <p className="hero-intro-lines">
          <span className="hero-intro-line">ম্যাংগো গার্ডেন · শীতের খাঁটি খেজুর গুড়</span>
          <span className="hero-intro-line">চিনি ও কেমিক্যালমুক্ত শতভাগ বিশুদ্ধতার নিশ্চয়তা</span>
        </p>

        {/* Headline in Bengali Calligraphy */}
        <h1 className="hero-main-title">
          <span className="hero-title-line">গাছির খাঁটি রসে তৈরি</span>
          <span className="hero-title-line">আসল খেজুরের গুড়</span>
        </h1>

        {/* Hero Visual Card */}
        <div className="hero-visual-card">
          <div className="hero-card-stage">
            {/* Saffron Sunburst Background */}
            <div className="hero-sunburst-bg">
              <HeroSunburst />
            </div>

            {/* Season Stamp Overlapping Top-Left */}
            <SeasonStampBadge line1="নতুন মৌসুমে" line2="শীত ১৪৩১" />

            {/* Main Subject Photo */}
            <img
              src={BRAND_IMAGES.heroPatali}
              alt="ঐতিহ্যবাহী খাঁটি খেজুরের পাটালি গুড়"
              className="hero-subject-img"
              loading="eager"
              fetchpriority="high"
            />

            {/* Secondary Circular Image Overlapping Bottom-Right */}
            <div className="hero-secondary-badge" title="৫ ধরনের গুড় কম্বো প্যাকেজ">
              <img src={BRAND_IMAGES.combo990} alt="কম্বো গুড় প্রিভিউ" />
            </div>
          </div>

          {/* Hero Bottom Joined Bar */}
          <div className="hero-bottom-bar">
            <div className="hero-bar-info">
              <strong>ক্যাশ অন ডেলিভারি</strong>
              <small>৯৯০৳ কম্বোতে ফ্রি ডেলিভারি · {DELIVERY_START_NOTICE}</small>
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={(e) => onPickAndOrder('gur-combo-990', e)}
            >
              <span>অর্ডার করুন</span>
              <span className="btn-arrow-circle" aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ==========================================================================
   3. SECTION 2: MENU INTRO + ILLUSTRATION ("আজকের মেনু" §5)
   ========================================================================== */
function MenuIntroSection({ onPickAndOrder, onOpenVideoModal }) {
  const menuRef = useRef(null)

  useGSAP(() => {
    const mm = gsap.matchMedia()

    mm.add({
      isReduced: '(prefers-reduced-motion: reduce)',
      all: '(min-width: 0px)'
    }, (context) => {
      const { isReduced } = context.conditions

      if (isReduced) {
        gsap.set('.menu-heritage-svg path, .menu-heritage-svg line, .menu-mini-thumb', {
          opacity: 1,
          scale: 1,
          y: 0,
          clearProps: 'all'
        })
        return
      }

      const strokeElements = menuRef.current?.querySelectorAll('.menu-heritage-svg path, .menu-heritage-svg line')
      if (strokeElements) {
        strokeElements.forEach(el => {
          const len = el.getTotalLength ? el.getTotalLength() : 300
          gsap.set(el, { strokeDasharray: len, strokeDashoffset: len })
        })
      }

      gsap.set('.menu-mini-thumb', { opacity: 0, scale: 0.85, y: 15 })

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: menuRef.current,
          start: 'top 75%',
          once: true
        }
      })

      if (strokeElements && strokeElements.length) {
        tl.to(strokeElements, {
          strokeDashoffset: 0,
          duration: 1.3,
          stagger: {
            each: 0.02,
            from: 'start'
          },
          ease: 'power2.out'
        })
      }

      tl.to('.menu-mini-thumb', {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 0.45,
        stagger: 0.08,
        ease: 'back.out(2)'
      }, '-=0.4')
    })
  }, { scope: menuRef })

  return (
    <section className="menu-intro-section" id="menu" ref={menuRef}>
      <div className="container">
        <div className="sec-header">
          <h2 className="sec-title">আজকের মেনু</h2>
          <p className="sec-subtitle">
            আপনার পছন্দ অনুযায়ী ১ কেজি বা মিক্স করে ৩ কেজি+ অর্ডার করুন — ৩ কেজিতে ৫০০ গ্রাম ঝোলা গুড় একদম ফ্রি!
          </p>
        </div>

        {/* Heritage Rural Bengal Illustration Card */}
        <div className="menu-illustration-card">
          <div className="menu-illustration-stage">
            <MenuHeritageIllustration className="menu-heritage-svg" />
          </div>

          {/* Overlaid Real Product Photos along bottom table plank */}
          <div className="menu-product-overlays">
            <div
              className="menu-mini-thumb"
              onClick={(e) => onPickAndOrder('gur-combo-990', e)}
              title="৯৯০৳ কম্বো প্যাকেজ"
            >
              <img src={BRAND_IMAGES.combo990} alt="কম্বো গুড়" />
            </div>
            <div
              className="menu-mini-thumb"
              onClick={(e) => onPickAndOrder('gur-lali', e)}
              title="লিকুইড বা লালি গুড়"
            >
              <img src="/img/IMG_8df5a126-73c7-4a1b-b32d-5c8caf3d6f24.jpg.jpeg" alt="লালি গুড়" />
            </div>
            <div
              className="menu-mini-thumb"
              onClick={(e) => onPickAndOrder('gur-dana-jhola', e)}
              title="দানা ঝোলা গুড়"
            >
              <img src="/img/IMG_bf2a2436-bacb-489e-81a2-ff49803c51b3.png" alt="দানা ঝোলা" />
            </div>
            <div
              className="menu-mini-thumb"
              onClick={(e) => onPickAndOrder('gur-patali-pata', e)}
              title="পাটালি পাটা গুড়"
            >
              <img src="/img/received_868957752222465.jpeg" alt="পাটালি গুড়" />
            </div>
          </div>

          {/* Video Strip Link */}
          <div className="menu-video-strip">
            <button
              type="button"
              className="video-strip-btn"
              onClick={onOpenVideoModal}
            >
              <Play size={16} fill="currentColor" />
              <span>বাগানের চুলায় রস জ্বালানোর তাজা ভিডিও দেখুন</span>
            </button>
            <span className="tag">লাইভ ভিডিও</span>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ==========================================================================
   4. SECTION 3: PRODUCT GRID (§6)
   ========================================================================== */
function ProductGridSection({ onPickAndOrder }) {
  const combo = combos[0]
  const gridSecRef = useRef(null)

  useGSAP(() => {
    const mm = gsap.matchMedia()

    mm.add({
      isReduced: '(prefers-reduced-motion: reduce)',
      all: '(min-width: 0px)'
    }, (context) => {
      const { isReduced } = context.conditions

      if (isReduced) {
        gsap.set('.product-card', { opacity: 1, y: 0, clearProps: 'all' })
        return
      }

      gsap.from('.product-card', {
        scrollTrigger: {
          trigger: gridSecRef.current,
          start: 'top 85%',
          toggleActions: 'play none none none'
        },
        y: 35,
        opacity: 0,
        duration: 0.6,
        stagger: 0.08,
        ease: 'power2.out'
      })
    })
  }, { scope: gridSecRef })

  return (
    <section className="product-grid-section" id="products" ref={gridSecRef}>
      <div className="container">
        <div className="sec-header">
          <h2 className="sec-title">গুড়ের মূল্য তালিকা</h2>
          <p className="sec-subtitle">
            প্রতিটি আইটেম শতভাগ চিনিমুক্ত ও সরাসরি গাছিদের হাতে মাটির পাত্রে জ্বাল দেওয়া
          </p>
        </div>

        <div className="product-grid">
          {/* Featured Signature Combo Card (Spans 2 columns) */}
          <article className="product-card span-2">
            <div className="featured-combo-content">
              <div className="card-img-well">
                <img src={combo.image} alt={combo.title} loading="lazy" />
              </div>

              <div className="featured-combo-details">
                <div className="featured-badge-row">
                  <span className="tag">বেস্ট সেলার কম্বো</span>
                  <span className="latin-small" style={{ color: '#2E7D32', fontWeight: 600 }}>
                    ✓ ফ্রি হোম ডেলিভারি
                  </span>
                </div>
                <h3 className="card-title" style={{ minHeight: 'auto', marginBottom: '4px' }}>
                  {combo.shortTitle}
                </h3>
                <p style={{ fontSize: '12px', color: '#7B6A5B', marginBottom: '8px' }}>
                  হাফ কেজি করে ৫ ধরনের খাঁটি খেজুর গুড় (মোট ২.৫ কেজি)
                </p>
                <div className="card-meta-row" style={{ marginTop: 'auto', marginBottom: '8px' }}>
                  <span className="card-unit">সর্বমোট ২.৫ কেজি</span>
                  <span className="card-price">৳{taka(combo.price)}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn-primary btn-card"
              style={{ marginTop: '10px' }}
              onClick={(e) => onPickAndOrder(combo.id, e)}
            >
              <span>অর্ডার করুন</span>
              <span className="btn-arrow-circle" aria-hidden="true">→</span>
            </button>
          </article>

          {/* 6 Loose Kg Products in 2-Column Grid */}
          {gurPrices.map((prod) => (
            <article className="product-card" key={prod.id}>
              <div className="card-img-well">
                <img src={prod.image} alt={prod.name} loading="lazy" />
              </div>

              <div className="card-tag-wrap">
                <span className="tag">{prod.tag}</span>
              </div>

              <h3 className="card-title">{prod.name}</h3>

              <div className="card-meta-row">
                <span className="card-unit">প্রতি {prod.unit}</span>
                <span className="card-price">৳{taka(prod.price)}</span>
              </div>

              <button
                type="button"
                className="btn-primary btn-card"
                onClick={(e) => onPickAndOrder(prod.id, e)}
              >
                <span>অর্ডার করুন</span>
                <span className="btn-arrow-circle" aria-hidden="true">→</span>
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ==========================================================================
   5. SECTION 5: DELIVERY PROMISE ILLUSTRATION ("...আপনার ঘরে" §8)
   ========================================================================== */
function DeliveryPromiseSection() {
  const deliveryRef = useRef(null)

  useGSAP(() => {
    const mm = gsap.matchMedia()

    mm.add({
      isReduced: '(prefers-reduced-motion: reduce)',
      all: '(min-width: 0px)'
    }, (context) => {
      const { isReduced } = context.conditions

      if (isReduced) {
        gsap.set('.delivery-illustration-svg path, .delivery-illustration-svg line, .delivery-speech-bubble', {
          opacity: 1,
          scale: 1,
          y: 0,
          clearProps: 'all'
        })
        return
      }

      const strokeElements = deliveryRef.current?.querySelectorAll(
        '.delivery-illustration-svg path, .delivery-illustration-svg line'
      )
      if (strokeElements) {
        strokeElements.forEach(el => {
          const len = el.getTotalLength ? el.getTotalLength() : 300
          gsap.set(el, { strokeDasharray: len, strokeDashoffset: len })
        })
      }

      gsap.set('.delivery-speech-bubble', { opacity: 0, scale: 0.88, y: 20 })

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: deliveryRef.current,
          start: 'top 75%',
          once: true
        }
      })

      if (strokeElements && strokeElements.length) {
        tl.to(strokeElements, {
          strokeDashoffset: 0,
          duration: 1.25,
          stagger: {
            each: 0.025,
            from: 'start'
          },
          ease: 'power2.out'
        })
      }

      tl.to('.delivery-speech-bubble', {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 0.55,
        ease: 'back.out(1.7)'
      }, '-=0.35')

      // Van ambient loop
      gsap.to('.delivery-van-group', {
        x: -7,
        duration: 1.6,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      })

      // Smoke wisps ambient loop
      gsap.to('.smoke-path', {
        y: -5,
        opacity: 0.9,
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut'
      })
    })
  }, { scope: deliveryRef })

  return (
    <section className="delivery-promise-section" id="delivery" ref={deliveryRef}>
      <div className="container">
        <div className="delivery-scene-card">
          <DeliveryHeritageIllustration />

          {/* Speech-Bubble Delivery Card */}
          <div className="delivery-speech-bubble">
            <span className="bubble-tag-disc" aria-hidden="true">
              <Truck size={14} />
            </span>
            <span className="bubble-pill-top">১-৩ দিনে ডেলিভারি</span>
            <h3 className="bubble-heading">আপনার দরজায়</h3>
            <p className="bubble-desc">
              সারা বাংলাদেশে দ্রুততম সময়ে ক্যাশ অন ডেলিভারি · {DELIVERY_START_NOTICE} · পার্সেল খুলে যাচাই করে তারপর টাকা পরিশোধ করুন।
            </p>
          </div>

          <div className="delivery-footer-note">
            <h3>ম্যাংগো গার্ডেনের খাঁটি গুড়, আপনার ঘরে</h3>
            <p>গাছিদের পরম যত্নে তৈরি ঐতিহ্যবাহী শীতের মিষ্টান্ন পৌঁছে দিচ্ছি সবার ঠিকানায়।</p>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ==========================================================================
   6. SECTION 6: ORDER MEMO (RECEIPT-STYLED ORDER FORM §9)
   ========================================================================== */
function OrderMemoSection({
  selected,
  onToggleItem,
  onUpdateQty,
  onResetCart,
  onOrderSuccess,
  onBeginCheckout,
  activePreviewId,
  onSelectPreview
}) {
  const { refreshAll } = useCms() || {}
  const [form, setForm] = useState({ name: '', phone: '', address: '' })
  const [err, setErr] = useState({})
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [orderErr, setOrderErr] = useState('')
  const sectionRef = useRef(null)
  const beginCheckoutRef = useRef(onBeginCheckout)
  beginCheckoutRef.current = onBeginCheckout

  const comboOption = orderOptions.find((o) => o.isCombo)
  const kgOptions = orderOptions.filter((o) => !o.isCombo)

  const comboQty = Math.min(comboOption.max, selected[comboOption.id] || 0)
  const looseEntries = kgOptions
    .map((opt) => ({ opt, qty: Math.min(opt.max, selected[opt.id] || 0) }))
    .filter((entry) => entry.qty > 0)

  const looseKg = looseEntries.reduce((sum, entry) => sum + entry.qty, 0)
  const hasFreeJholaBonus = looseKg >= FREE_BONUS_MIN_KG
  const progressRatio = Math.min(1, looseKg / FREE_BONUS_MIN_KG)

  const comboSubtotal = comboQty * comboOption.price
  const looseSubtotal = looseEntries.reduce((sum, entry) => sum + entry.opt.price * entry.qty, 0)
  const subtotal = comboSubtotal + looseSubtotal

  const hasItems = comboQty > 0 || looseKg > 0
  const delivery = !hasItems ? 0 : comboQty > 0 ? 0 : DELIVERY_CHARGE
  const total = subtotal + delivery

  // Live Total Number Tween
  const [displayedTotal, setDisplayedTotal] = useState(total)
  const totalTweenRef = useRef({ val: total })

  useEffect(() => {
    const obj = totalTweenRef.current
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReduced) {
      setDisplayedTotal(total)
      return
    }

    gsap.to(obj, {
      val: total,
      duration: 0.45,
      ease: 'power2.out',
      onUpdate: () => {
        setDisplayedTotal(Math.round(obj.val))
      }
    })

    const totalEl = document.querySelector('.total-amount')
    if (totalEl) {
      gsap.fromTo(totalEl, { scale: 1.12 }, { scale: 1, duration: 0.3, ease: 'power1.out' })
    }
  }, [total])

  // Stepper quantity pulse
  const handleStepperChange = (id, newQty, max) => {
    onUpdateQty(id, newQty, max)
    const numEl = document.getElementById(`stepper-qty-${id}`)
    if (numEl) {
      gsap.fromTo(
        numEl,
        { scale: 1.32, color: '#B8231C' },
        { scale: 1, color: '#2A1A12', duration: 0.25, ease: 'back.out(2)' }
      )
    }
  }

  // Receipt Print Reveal & Seal Stamp via GSAP
  useGSAP(() => {
    const mm = gsap.matchMedia()

    mm.add({
      isReduced: '(prefers-reduced-motion: reduce)',
      all: '(min-width: 0px)'
    }, (context) => {
      const { isReduced } = context.conditions

      if (isReduced) {
        gsap.set('.receipt-memo-card, .memo-header, .memo-two-col-grid, .memo-shop-seal', {
          opacity: 1,
          y: 0,
          scale: 1,
          clearProps: 'all'
        })
        return
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 80%',
          toggleActions: 'play none none none'
        }
      })

      tl.from('.receipt-memo-card', {
        y: 40,
        opacity: 0,
        duration: 0.75,
        ease: 'power2.out'
      })
      .from('.memo-header', {
        y: -15,
        opacity: 0,
        duration: 0.4,
        ease: 'power2.out'
      }, '-=0.4')
      .from('.memo-left-col, .memo-right-col', {
        y: 18,
        opacity: 0,
        stagger: 0.12,
        duration: 0.5,
        ease: 'power2.out'
      }, '-=0.2')
      .from('.memo-shop-seal', {
        scale: 2.2,
        rotation: -30,
        opacity: 0,
        duration: 0.55,
        ease: 'back.out(2)'
      }, '-=0.1')
    })
  }, { scope: sectionRef })

  // Current preview image
  const currentPreviewItem =
    orderOptions.find((o) => o.id === activePreviewId) || comboOption

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          beginCheckoutRef.current?.()
        }
      },
      { threshold: 0.15 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setOrderErr('')

    if (!hasItems) {
      setOrderErr('অনুগ্রহ করে অন্তত একটি গুড় বা প্যাকেজ নির্বাচন করুন')
      gsap.fromTo(
        '.memo-product-list',
        { x: -12 },
        { x: 0, duration: 0.45, ease: 'elastic.out(1, 0.3)' }
      )
      return
    }

    const er = {}
    if (form.name.trim().length < 2) er.name = 'আপনার নাম লিখুন'
    const normalizedPhone = normalizeBdPhone(form.phone)
    if (!isValidBdPhone(normalizedPhone)) er.phone = 'সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 01XXXXXXXXX)'
    if (form.address.trim().length < 8) er.address = 'পূর্ণ ঠিকানা লিখুন (বাসা, রোড, থানা, জেলা)'
    setErr(er)
    if (Object.keys(er).length) {
      gsap.fromTo(
        '.memo-fields-block',
        { x: -12 },
        { x: 0, duration: 0.45, ease: 'elastic.out(1, 0.3)' }
      )
      return
    }

    beginCheckoutRef.current?.()
    setLoading(true)

    const orderId = 'MG-' + Date.now().toString(36).toUpperCase()
    const clientIp = await fetchClientIp()

    const itemsPayload = []
    const summaryParts = []

    if (comboQty > 0) {
      itemsPayload.push({
        id: comboOption.id,
        name: comboOption.label,
        price: comboOption.price,
        quantity: comboQty,
        unit: comboOption.unit,
        total: comboOption.price * comboQty
      })
      summaryParts.push(`${comboOption.label} (${toBn(comboQty)} ${comboOption.unit})`)
    }

    looseEntries.forEach(({ opt, qty }) => {
      itemsPayload.push({
        id: opt.id,
        name: opt.label,
        price: opt.price,
        quantity: qty,
        unit: opt.unit,
        total: opt.price * qty
      })
      summaryParts.push(`${opt.label} (${toBn(qty)} ${opt.unit})`)
    })

    if (hasFreeJholaBonus) {
      itemsPayload.push({
        id: 'free-jhola-500g',
        name: FREE_BONUS_ITEM_NAME,
        price: 0,
        quantity: 1,
        unit: 'প্যাক',
        total: 0
      })
      summaryParts.push(`🎁 ${FREE_BONUS_ITEM_NAME}`)
    }

    const formattedProductName = summaryParts.join(' + ')
    const totalCount = comboQty + looseKg
    const primaryUnit = comboQty > 0 && looseKg === 0 ? 'প্যাকেজ' : looseKg > 0 && comboQty === 0 ? 'কেজি' : 'আইটেম'
    const primaryPkgId = comboQty > 0 && looseKg === 0 ? comboOption.id : looseEntries[0]?.opt.id || comboOption.id

    const orderPayload = {
      order_id: orderId,
      name: form.name.trim(),
      phone: normalizedPhone,
      address: form.address.trim(),
      package_id: primaryPkgId,
      product_name: formattedProductName,
      package_name: formattedProductName,
      quantity: totalCount,
      unit: primaryUnit,
      unit_price: totalCount > 0 ? Math.round(subtotal / totalCount) : subtotal,
      subtotal: subtotal,
      delivery_charge: delivery,
      delivery_fee: delivery,
      total_price: total,
      ip_address: clientIp,
      items: itemsPayload,
      status: 'pending'
    }

    const result = await submitOrder(orderPayload)
    setLoading(false)

    if (result.success) {
      if (refreshAll) {
        try { refreshAll() } catch (err) { /* silent */ }
      }
      setForm({ name: '', phone: '', address: '' })
      if (onOrderSuccess) {
        onOrderSuccess(orderPayload)
      } else {
        setDone(true)
      }
    } else {
      setOrderErr(result.error || 'অর্ডার করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।')
    }
  }

  return (
    <section className="order-memo-section" id="order" ref={sectionRef}>
      <div className="container">
        <div className="sec-header">
          <h2 className="sec-title">অর্ডার করুন</h2>
          <p className="sec-subtitle">
            ক্যাশ অন ডেলিভারি · {DELIVERY_START_NOTICE} · পণ্য হাতে পেয়ে টাকা পরিশোধ
          </p>
        </div>

        {/* Receipt Styled Memo Card */}
        <div className="receipt-memo-card desktop-two-col">
          {/* Memo Header */}
          <div className="memo-header">
            <div className="memo-header-top-row">
              <img src={BRAND_IMAGES.logo} alt="ম্যাংগো গার্ডেন" className="memo-logo" />
              <h3 className="memo-title">অর্ডার মেমো</h3>
              <span className="memo-no">মেমো নং ০১</span>
            </div>
            <p className="memo-shop-subtitle">
              ম্যাংগো গার্ডেন · খাঁটি খেজুরের গুড় · যশোর ও নাটোর
            </p>
            <div className="memo-dashed-sep" />
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="memo-two-col-grid">
              {/* Left Column: Product Showcase & List */}
              <div className="memo-left-col">
                {/* Product Showcase */}
                <div className="memo-showcase">
                  <div className="memo-big-preview">
                    <img
                      src={currentPreviewItem.image}
                      alt={currentPreviewItem.label}
                    />
                  </div>
                  <div className="memo-thumbs-strip">
                    {orderOptions.map((opt) => (
                      <button
                        type="button"
                        key={opt.id}
                        className={`memo-thumb-item ${currentPreviewItem.id === opt.id ? 'active' : ''}`}
                        onClick={() => onSelectPreview(opt.id)}
                        title={opt.label}
                      >
                        <img src={opt.image} alt={opt.label} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subheading */}
                <div className="memo-section-heading">
                  <span className="heading-red-bar" />
                  <span className="heading-title">গুড় ও পরিমাণ বেছে নিন</span>
                  <span className="heading-hint">একাধিক বেছে নিতে পারেন</span>
                </div>

                {/* Bonus Tracker */}
                <div className={`memo-bonus-tracker ${hasFreeJholaBonus ? 'unlocked' : ''}`}>
                  <div className="bonus-tracker-labels">
                    <span>
                      {hasFreeJholaBonus
                        ? '🎉 অভিনন্দন! ৩ কেজি+ গুড়ে ৫০০ গ্রাম ঝোলা গুড় একদম ফ্রি যুক্ত হয়েছে!'
                        : looseKg > 0
                        ? `💠 আর ${toBn(FREE_BONUS_MIN_KG - looseKg)} কেজি নিলেই ৫০০ গ্রাম ঝোলা গুড় ফ্রি!`
                        : '💠 যেকোনো তিন কেজি গুড় নিলে ৫০০ গ্রাম ঝোলা গুড় ফ্রি!'}
                    </span>
                    <span>{toBn(Math.min(looseKg, FREE_BONUS_MIN_KG))}/{toBn(FREE_BONUS_MIN_KG)} কেজি</span>
                  </div>
                  <div className="bonus-track">
                    <div
                      className="bonus-fill"
                      style={{ width: `${progressRatio * 100}%` }}
                    />
                  </div>
                </div>

                {/* Product List */}
                <div className="memo-product-list">
                  {/* 1. Combo Package Row */}
                  <div
                    id={`memo-row-${comboOption.id}`}
                    className={`memo-product-row ${comboQty > 0 ? 'checked' : ''}`}
                  >
                    <div
                      className="memo-chk-box"
                      onClick={() => {
                        onToggleItem(comboOption.id)
                        onSelectPreview(comboOption.id)
                      }}
                      role="checkbox"
                      aria-checked={comboQty > 0}
                    >
                      <svg
                        className={`memo-tick-svg ${comboQty > 0 ? 'checked' : ''}`}
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <div
                      className="memo-row-thumb"
                      onClick={() => onSelectPreview(comboOption.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <img src={comboOption.image} alt={comboOption.label} />
                    </div>
                    <div className="memo-row-meta">
                      <div className="memo-row-name">{comboOption.label}</div>
                      <div className="memo-row-sub" style={{ color: '#2E7D32', fontWeight: 600 }}>
                        হোম ডেলিভারি সম্পূর্ণ ফ্রি! (২.৫ কেজি)
                      </div>
                      {comboQty > 0 && (
                        <div className="memo-stepper">
                          <button
                            type="button"
                            onClick={() => handleStepperChange(comboOption.id, comboQty - 1, comboOption.max)}
                            aria-label="প্যাকেজ কমান"
                          >
                            −
                          </button>
                          <span id={`stepper-qty-${comboOption.id}`} className="memo-stepper-val">
                            {toBn(comboQty)} প্যাক
                          </span>
                          <button
                            type="button"
                            onClick={() => handleStepperChange(comboOption.id, comboQty + 1, comboOption.max)}
                            disabled={comboQty >= comboOption.max}
                            aria-label="প্যাকেজ বাড়ান"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="memo-row-price-col">
                      <span className="memo-row-price">৳{taka(comboOption.price)}</span>
                    </div>
                  </div>

                  {/* 2. Loose Kg Products Rows */}
                  {kgOptions.map((opt) => {
                    const qty = selected[opt.id] || 0
                    const isChecked = qty > 0

                    return (
                      <div
                        id={`memo-row-${opt.id}`}
                        className={`memo-product-row ${isChecked ? 'checked' : ''}`}
                        key={opt.id}
                      >
                        <div
                          className="memo-chk-box"
                          onClick={() => {
                            onToggleItem(opt.id)
                            onSelectPreview(opt.id)
                          }}
                          role="checkbox"
                          aria-checked={isChecked}
                        >
                          <svg
                            className={`memo-tick-svg ${isChecked ? 'checked' : ''}`}
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                        <div
                          className="memo-row-thumb"
                          onClick={() => onSelectPreview(opt.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <img src={opt.image} alt={opt.label} />
                        </div>
                        <div className="memo-row-meta">
                          <div className="memo-row-name">{opt.label}</div>
                          <div className="memo-row-sub">{opt.sub}</div>
                          {isChecked && (
                            <div className="memo-stepper">
                              <button
                                type="button"
                                onClick={() => handleStepperChange(opt.id, qty - 1, opt.max)}
                                aria-label={`${opt.label} কমান`}
                              >
                                −
                              </button>
                              <span id={`stepper-qty-${opt.id}`} className="memo-stepper-val">
                                {toBn(qty)} কেজি
                              </span>
                              <button
                                type="button"
                                onClick={() => handleStepperChange(opt.id, qty + 1, opt.max)}
                                disabled={qty >= opt.max}
                                aria-label={`${opt.label} বাড়ান`}
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="memo-row-price-col">
                          <span className="memo-row-price">
                            ৳{taka(opt.price)}<small style={{ fontSize: '11px', color: '#7B6A5B' }}>/কেজি</small>
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Right Column: Customer Fields & Summary */}
              <div className="memo-right-col memo-col-divider">
                <div className="memo-section-heading">
                  <span className="heading-red-bar" />
                  <span className="heading-title">আপনার তথ্য ও ঠিকানা</span>
                </div>

                <div className="memo-fields-block">
                  <div className="memo-field-group">
                    <div className="memo-field-label-row">
                      <label className="memo-field-label" htmlFor="name">আপনার নাম</label>
                      <span className="latin-small">· Full Name</span>
                    </div>
                    <input
                      id="name"
                      className="memo-input"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="যেমন: মোঃ সাকিব হাসান"
                    />
                    {err.name && <span className="field-error-text">{err.name}</span>}
                  </div>

                  <div className="memo-field-group">
                    <div className="memo-field-label-row">
                      <label className="memo-field-label" htmlFor="phone">মোবাইল নম্বর</label>
                      <span className="latin-small">· Mobile Number</span>
                    </div>
                    <input
                      id="phone"
                      className="memo-input"
                      inputMode="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="01XXXXXXXXX"
                    />
                    {err.phone && <span className="field-error-text">{err.phone}</span>}
                  </div>

                  <div className="memo-field-group">
                    <div className="memo-field-label-row">
                      <label className="memo-field-label" htmlFor="address">পূর্ণ ঠিকানা</label>
                      <span className="latin-small">· Delivery Address</span>
                    </div>
                    <textarea
                      id="address"
                      className="memo-input memo-textarea"
                      rows="2"
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="বাসা/হোল্ডিং, রোড, থানা, জেলা"
                    />
                    {err.address && <span className="field-error-text">{err.address}</span>}
                  </div>
                </div>

                {/* Recalculation Summary */}
                <div className="memo-summary-table">
                  {comboQty > 0 && (
                    <div className="memo-summary-row">
                      <span>{comboOption.label} ({toBn(comboQty)} প্যাক)</span>
                      <span>৳{taka(comboSubtotal)}</span>
                    </div>
                  )}

                  {looseEntries.map(({ opt, qty }) => (
                    <div className="memo-summary-row" key={opt.id}>
                      <span>{opt.label} ({toBn(qty)} কেজি)</span>
                      <span>৳{taka(opt.price * qty)}</span>
                    </div>
                  ))}

                  {hasFreeJholaBonus && (
                    <div className="memo-summary-row" style={{ color: '#2E7D32' }}>
                      <span>🎁 {FREE_BONUS_ITEM_NAME}</span>
                      <span>ফ্রি! (৳০)</span>
                    </div>
                  )}

                  <div className="memo-summary-row">
                    <span>ডেলিভারি চার্জ</span>
                    {!hasItems ? (
                      <span>৳০</span>
                    ) : delivery === 0 ? (
                      <span className="free-tag">ফ্রি হোম ডেলিভারি 🎉</span>
                    ) : (
                      <span>৳{taka(delivery)}</span>
                    )}
                  </div>

                  <div className="memo-summary-row total-row">
                    <span>সর্বমোট পরিশোধযোগ্য</span>
                    <span className="total-amount">৳{taka(displayedTotal)}</span>
                  </div>
                </div>

                {orderErr && (
                  <div className="field-error-text" style={{ textAlign: 'center', marginBottom: '10px' }}>
                    {orderErr}
                  </div>
                )}

                {/* Full Width Submit Button */}
                <button
                  type="submit"
                  className="btn-primary btn-lg"
                  disabled={loading || !hasItems}
                >
                  <span>{loading ? 'অর্ডার প্রসেস হচ্ছে...' : 'অর্ডার নিশ্চিত করুন'}</span>
                  <span className="btn-arrow-circle" aria-hidden="true">→</span>
                </button>

                <div className="memo-cod-note">
                  <ShieldCheck size={14} color="#B8231C" />
                  <span>ক্যাশ অন ডেলিভারি — পণ্য হাতে পেয়ে যাচাই করে মূল্য দিন</span>
                </div>

                {/* Memo Footer Signature & Shop Seal Stamp */}
                <div className="memo-sign-row">
                  <span className="memo-sign-left">ধন্যবাদান্তে,</span>
                  <span className="memo-sign-brand">ম্যাংগো গার্ডেন</span>
                  <HeritageShopSeal />
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Done Modal fallback */}
      {done && (
        <div className="modal" onClick={() => { setDone(false); onResetCart(); }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="check">✓</div>
            <h3>ধন্যবাদ, {form.name}!</h3>
            <p>আপনার অর্ডারটি সফলভাবে গৃহীত হয়েছে। খুব শীঘ্রই আমাদের প্রতিনিধি কল করে কনফার্ম করবেন।</p>
            <button
              type="button"
              className="btn-primary btn-card"
              onClick={() => { setDone(false); onResetCart(); }}
            >
              ঠিক আছে
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

/* ==========================================================================
   7. SECTION 7: HERITAGE FOOTER (§10)
   ========================================================================== */
function ScrollProgressLine() {
  const lineRef = useRef(null)

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      const progress = docHeight > 0 ? Math.min(1, Math.max(0, scrollY / docHeight)) : 0
      if (lineRef.current) {
        lineRef.current.style.transform = `scaleX(${progress})`
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return <div className="scroll-progress-line" ref={lineRef} aria-hidden="true" />
}

function HeritageFooter({ onOpenAdmin, siteSettings }) {
  const { waE164, waDisplay } = resolveWhatsAppConfig(siteSettings)
  const phoneTel = waE164.startsWith('88') ? waE164.slice(2) : waE164
  const footerRef = useRef(null)

  useGSAP(() => {
    const mm = gsap.matchMedia()
    mm.add({
      isReduced: '(prefers-reduced-motion: reduce)',
      all: '(min-width: 0px)'
    }, (context) => {
      const { isReduced } = context.conditions
      if (isReduced) return

      gsap.from('.footer-slogan-wrap, .footer-contact-pills', {
        scrollTrigger: {
          trigger: footerRef.current,
          start: 'top 85%'
        },
        y: 25,
        opacity: 0,
        stagger: 0.15,
        duration: 0.65,
        ease: 'power2.out'
      })

      gsap.from('.footer-giant-wordmark', {
        scrollTrigger: {
          trigger: footerRef.current,
          start: 'top 80%'
        },
        letterSpacing: '10px',
        opacity: 0,
        duration: 1.2,
        ease: 'power2.out'
      })
    })
  }, { scope: footerRef })

  return (
    <footer className="heritage-footer" id="footer" ref={footerRef}>
      <WavyTopEdge />

      <div className="container footer-inner-content">
        <div className="footer-top-row">
          <a href="#top" className="footer-top-link">
            <ChevronUp size={16} />
            <span>উপরে চলুন</span>
          </a>
          <span className="footer-brand-title">ম্যাংগো গার্ডেন</span>
        </div>

        <div className="footer-slogan-wrap">
          <h3 className="footer-slogan">গ্রীষ্মে আম, শীতে গুড়।</h3>
          <p className="footer-slogan-sub">
            ১০০% খাঁটি খেজুরের গুড় · {DELIVERY_START_NOTICE}
          </p>
        </div>

        {/* Contact Pills */}
        <div className="footer-contact-pills">
          <a href={`tel:${phoneTel}`} className="contact-pill-card">
            <span className="pill-icon-circle phone">
              <Phone size={18} />
            </span>
            <div className="pill-info">
              <span>সরাসরি কল করুন</span>
              <strong>{waDisplay}</strong>
            </div>
          </a>

          <a
            href={`https://wa.me/${waE164}?text=${encodeURIComponent('আসসালামু আলাইকুম ম্যাংগো গার্ডেন, খাঁটি খেজুরের গুড় সম্পর্কে জানতে / অর্ডার করতে চাচ্ছি।')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="contact-pill-card"
            onClick={() => trackMessageAction({ channel: 'whatsapp', placement: 'footer', siteSettings })}
          >
            <span className="pill-icon-circle wa">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </span>
            <div className="pill-info">
              <span>হোয়াটসঅ্যাপ মেসেজ</span>
              <strong>মেসেজ পাঠান</strong>
            </div>
          </a>
        </div>

        {/* Giant Decorative Brand Wordmark */}
        <div className="footer-giant-wordmark" aria-hidden="true">
          ম্যাংগো গার্ডেন
        </div>

        {/* Bottom Row */}
        <div className="footer-bottom-row">
          <span>© {toBn(new Date().getFullYear())} ম্যাংগো গার্ডেন · সর্বস্বত্ব সংরক্ষিত</span>
          <a
            href="https://wa.me/8801540400247"
            target="_blank"
            rel="noopener noreferrer"
            className="dev-credit-link"
            title="Developed and Designed by Nexova"
          >
            Developed and Designed by <strong>Nexova</strong>
          </a>
        </div>
      </div>
    </footer>
  )
}

/* ==========================================================================
   8. STICKY MOBILE BAR & FLOATING CHAT DOCK (§11)
   ========================================================================== */
function StickyBar({ show, totalItems, grandTotal, onOpenCheckout }) {
  return (
    <div className={`sticky-bar ${show ? 'show' : ''}`}>
      <div className="sticky-bar-left">
        <small>খাঁটি খেজুর গুড়</small>
        <strong>
          {totalItems > 0
            ? `${toBn(totalItems)}টি নির্বাচিত · ৳${taka(grandTotal)}`
            : '৳৩৭০ থেকে শুরু'}
        </strong>
      </div>
      <button
        type="button"
        className="btn-primary"
        style={{ height: '40px', padding: '0 16px', fontSize: '14px' }}
        onClick={() => (onOpenCheckout ? onOpenCheckout() : scrollToSection('order'))}
      >
        <span>অর্ডার করুন</span>
        <span className="btn-arrow-circle" aria-hidden="true">→</span>
      </button>
    </div>
  )
}

function FloatingChatDock({ raised, siteSettings }) {
  const { waE164, waDisplay } = resolveWhatsAppConfig(siteSettings)
  const fbUrl = siteSettings?.facebook_page || 'https://www.facebook.com/mangogardenbd1'

  return (
    <aside className={`floating-dock ${raised ? 'with-sticky' : ''}`} aria-label="তাৎক্ষণিক যোগাযোগ">
      <a
        href={`https://wa.me/${waE164}?text=${encodeURIComponent('আসসালামু আলাইকুম ম্যাংগো গার্ডেন, খাঁটি খেজুরের গুড় সম্পর্কে জানতে / অর্ডার করতে চাচ্ছি।')}`}
        target="_blank"
        rel="noopener noreferrer"
        className="floating-pill"
        aria-label={`হোয়াটসঅ্যাপ: ${waDisplay}`}
        onClick={() => trackMessageAction({ channel: 'whatsapp', placement: 'floating_widget', siteSettings })}
      >
        <span className="floating-icon-disc wa" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </span>
        <span>হোয়াটসঅ্যাপ</span>
      </a>

      <a
        href={fbUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="floating-pill"
        aria-label="ফেসবুক পেজে যোগাযোগ করুন"
        onClick={() => trackMessageAction({ channel: 'facebook', placement: 'floating_widget', siteSettings })}
      >
        <span className="floating-icon-disc fb" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        </span>
        <span>ফেসবুক</span>
      </a>
    </aside>
  )
}

/* ==========================================================================
   VIDEO MODAL COMPONENT (FOR LIVE CRAFT PROCESS)
   ========================================================================== */
function VideoModal({ isOpen, onClose }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="modal" onClick={onClose} role="dialog" aria-modal="true" aria-label="খাঁটি গুড় তৈরির ভিডিও">
      <div className="modal-card" style={{ maxWidth: '480px', padding: '16px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <strong style={{ fontSize: '15px', color: '#2A1A12' }}>🔥 তাফালে রস জ্বাল দেওয়ার লাইভ ভিডিও</strong>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '4px', borderRadius: '50%', background: '#F5ECDD' }}
            aria-label="বন্ধ করুন"
          >
            <X size={20} />
          </button>
        </div>
        <div style={{ borderRadius: '12px', overflow: 'hidden', background: '#000' }}>
          <video
            ref={videoRef}
            src={BRAND_IMAGES.craftVideo}
            controls
            autoPlay
            playsInline
            style={{ width: '100%', display: 'block' }}
          />
        </div>
      </div>
    </div>
  )
}

/* ==========================================================================
   STOREFRONT MAIN CONTAINER
   ========================================================================== */
function Storefront({ onOpenAdmin, onOrderSuccess }) {
  const { siteSettings } = useCms() || {}
  const [selected, setSelected] = useState({ 'gur-combo-990': 1 })
  const [activePreviewId, setActivePreviewId] = useState('gur-combo-990')
  const [stickyVisible, setStickyVisible] = useState(false)
  const [videoModalOpen, setVideoModalOpen] = useState(false)
  const lastCheckoutSigRef = useRef('')

  useEffect(() => {
    const onScroll = () => {
      const hero = document.getElementById('top')
      const order = document.getElementById('order')
      const heroHeight = hero?.offsetHeight || 450
      const r = order?.getBoundingClientRect()
      const inOrder = r && r.top < window.innerHeight && r.bottom > 0
      setStickyVisible(window.scrollY > heroHeight && !inOrder)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const fireBeginCheckout = (cartMap = selected) => {
    const comboOption = orderOptions.find((o) => o.isCombo)
    const kgOptions = orderOptions.filter((o) => !o.isCombo)

    const comboQty = Math.min(comboOption.max, Math.max(0, Math.floor(Number(cartMap[comboOption.id] || 0))))
    const looseEntries = kgOptions
      .map((opt) => ({
        opt,
        qty: Math.min(opt.max, Math.max(0, Math.floor(Number(cartMap[opt.id] || 0))))
      }))
      .filter((entry) => entry.qty > 0)

    const looseKg = looseEntries.reduce((sum, entry) => sum + entry.qty, 0)
    const items = []

    if (comboQty > 0) {
      items.push({
        id: comboOption.id,
        name: comboOption.label,
        price: comboOption.price,
        quantity: comboQty,
        unit: comboOption.unit
      })
    }

    looseEntries.forEach(({ opt, qty }) => {
      items.push({
        id: opt.id,
        name: opt.label,
        price: opt.price,
        quantity: qty,
        unit: opt.unit
      })
    })

    if (looseKg >= FREE_BONUS_MIN_KG) {
      items.push({
        id: 'free-jhola-500g',
        name: FREE_BONUS_ITEM_NAME,
        price: 0,
        quantity: 1,
        unit: 'প্যাক'
      })
    }

    const subtotal =
      comboQty * comboOption.price +
      looseEntries.reduce((sum, entry) => sum + entry.opt.price * entry.qty, 0)
    const hasItems = comboQty > 0 || looseKg > 0
    const delivery = !hasItems ? 0 : comboQty > 0 ? 0 : DELIVERY_CHARGE
    const grandTotal = subtotal + delivery
    const totalItems = comboQty + looseKg
    const sig = `${items.map((it) => `${it.id}:${it.quantity}`).join('|')}@${grandTotal}`

    if (totalItems <= 0 || !items.length) return
    if (lastCheckoutSigRef.current === sig) return
    lastCheckoutSigRef.current = sig

    trackInitiateCheckout({
      product: {
        id: items[0].id,
        title: items.map((it) => `${it.name} (${toBn(it.quantity)} ${it.unit})`).join(' + '),
        price: grandTotal
      },
      quantity: totalItems,
      total: grandTotal,
      items,
      siteSettings
    })
  }

  const getOptionLimit = (id) => {
    const option = orderOptions.find((o) => o.id === id)
    if (option?.max) return option.max
    return option?.isCombo ? MAX_COMBO_PACKS : MAX_LOOSE_KG_PER_ITEM
  }

  const toggleItem = (id) => {
    const limit = getOptionLimit(id)
    setSelected((prev) => {
      const next = { ...prev }
      if ((next[id] || 0) > 0) delete next[id]
      else next[id] = Math.min(limit, 1)
      return next
    })
    setActivePreviewId(id)
  }

  const updateQty = (id, qty, max) => {
    const limit = Math.min(max ?? getOptionLimit(id), getOptionLimit(id))
    const safeQty = Math.floor(Number(qty) || 0)
    setSelected((prev) => {
      const next = { ...prev }
      if (safeQty <= 0) delete next[id]
      else next[id] = Math.min(limit, safeQty)
      return next
    })
    setActivePreviewId(id)
  }

  const openCheckoutAndTrack = () => {
    fireBeginCheckout(selected)
    scrollToSection('order')
  }

  const pickAndScrollToOrder = (id, event) => {
    const limit = getOptionLimit(id)
    const nextSelected = {
      ...selected,
      [id]: Math.min(limit, Math.max(1, selected[id] || 0))
    }
    setSelected(nextSelected)
    setActivePreviewId(id)
    fireBeginCheckout(nextSelected)

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion || !event) {
      scrollToSection('order')
      return
    }

    // Hand-off Fly-to-Cart Animation
    const targetCard =
      event.currentTarget?.closest?.('.product-card') ||
      event.currentTarget?.closest?.('.featured-combo-content') ||
      event.currentTarget?.closest?.('.menu-mini-thumb') ||
      event.currentTarget?.closest?.('.hero-visual-card') ||
      event.currentTarget?.closest?.('article')
    const sourceImg = targetCard?.querySelector?.('img')

    if (sourceImg && typeof document !== 'undefined') {
      const imgRect = sourceImg.getBoundingClientRect()
      const flyer = document.createElement('div')
      flyer.className = 'fly-to-cart-particle'
      flyer.style.cssText = `
        position: fixed;
        left: ${imgRect.left}px;
        top: ${imgRect.top}px;
        width: ${imgRect.width}px;
        height: ${imgRect.height}px;
        border-radius: 14px;
        overflow: hidden;
        box-shadow: 0 16px 36px rgba(184, 35, 28, 0.45);
        border: 2px solid #B8231C;
        background: #FFFDF9;
        z-index: 999999;
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
      `
      const flyerInner = document.createElement('img')
      flyerInner.src = sourceImg.src
      flyerInner.alt = 'Flying product'
      flyerInner.style.cssText = 'width: 100%; height: 100%; object-fit: contain; padding: 6px;'
      flyer.appendChild(flyerInner)
      document.body.appendChild(flyer)

      // Start scrolling to order memo
      scrollToSection('order')

      const destX = window.innerWidth / 2 - (imgRect.left + imgRect.width / 2)
      const destY = Math.min(window.innerHeight * 0.75, 420)

      gsap.to(flyer, {
        x: destX,
        y: destY,
        scale: 0.28,
        rotation: 10,
        opacity: 0,
        duration: 0.65,
        ease: 'power2.inOut',
        onComplete: () => {
          flyer.remove()
          // Highlight the selected row in memo after arrival
          setTimeout(() => {
            const row = document.getElementById(`memo-row-${id}`)
            if (row) {
              gsap.fromTo(
                row,
                { backgroundColor: 'rgba(184, 35, 28, 0.22)', scale: 1.025 },
                { backgroundColor: 'transparent', scale: 1, duration: 0.85, ease: 'power2.out' }
              )
            }
          }, 350)
        }
      })
    } else {
      scrollToSection('order')
    }
  }

  const comboOption = orderOptions.find((o) => o.isCombo)
  const kgOptions = orderOptions.filter((o) => !o.isCombo)
  const comboQty = selected[comboOption.id] || 0
  const looseKg = kgOptions.reduce((sum, o) => sum + (selected[o.id] || 0), 0)
  const subtotal =
    comboQty * comboOption.price +
    kgOptions.reduce((sum, o) => sum + o.price * (selected[o.id] || 0), 0)
  const hasItems = comboQty > 0 || looseKg > 0
  const delivery = !hasItems ? 0 : comboQty > 0 ? 0 : DELIVERY_CHARGE
  const grandTotal = subtotal + delivery
  const totalItems = comboQty + looseKg

  return (
    <>
      <ScrollProgressLine />
      <HeritageHeader
        totalItems={totalItems}
        grandTotal={grandTotal}
        onOpenCheckout={openCheckoutAndTrack}
        siteSettings={siteSettings}
      />

      <main>
        {/* 1. Hero (§4) */}
        <HeroSection onPickAndOrder={pickAndScrollToOrder} />

        <SectionDivider />

        {/* 2. Menu Intro + Illustration (§5) */}
        <MenuIntroSection
          onPickAndOrder={pickAndScrollToOrder}
          onOpenVideoModal={() => setVideoModalOpen(true)}
        />

        <SectionDivider />

        {/* 3. Product Grid (§6) */}
        <ProductGridSection onPickAndOrder={pickAndScrollToOrder} />

        <SectionDivider />

        {/* 4. Testimonials (§7) */}
        <CustomerReviews />

        <SectionDivider />

        {/* 5. Delivery Promise (§8) */}
        <DeliveryPromiseSection />

        <SectionDivider />

        {/* 6. Order Memo (§9) */}
        <OrderMemoSection
          selected={selected}
          onToggleItem={toggleItem}
          onUpdateQty={updateQty}
          onResetCart={() => {
            lastCheckoutSigRef.current = ''
            setSelected({ 'gur-combo-990': 1 })
            setActivePreviewId('gur-combo-990')
          }}
          onBeginCheckout={() => fireBeginCheckout(selected)}
          onOrderSuccess={onOrderSuccess}
          activePreviewId={activePreviewId}
          onSelectPreview={(id) => setActivePreviewId(id)}
        />
      </main>

      {/* 7. Footer (§10) */}
      <HeritageFooter onOpenAdmin={onOpenAdmin} siteSettings={siteSettings} />

      {/* Floating Dock & Sticky Bar (§11) */}
      <FloatingChatDock raised={stickyVisible} siteSettings={siteSettings} />
      <StickyBar
        show={stickyVisible}
        totalItems={totalItems}
        grandTotal={grandTotal}
        onOpenCheckout={openCheckoutAndTrack}
      />

      {/* Video Modal */}
      <VideoModal
        isOpen={videoModalOpen}
        onClose={() => setVideoModalOpen(false)}
      />
    </>
  )
}

/* ==========================================================================
   MAIN APP ROUTER
   ========================================================================== */
export default function App() {
  const [currentView, setCurrentView] = useState(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash === '#admin' || window.location.pathname.startsWith('/admin')) {
        return 'admin'
      }
      if (window.location.hash === '#success' || window.location.pathname.startsWith('/order-success')) {
        return 'success'
      }
    }
    return 'store'
  })

  const [latestOrder, setLatestOrder] = useState(() => {
    if (typeof window === 'undefined') return null
    try {
      const saved = sessionStorage.getItem('mangogarden_last_order')
      return saved ? JSON.parse(saved) : null
    } catch (e) {
      return null
    }
  })

  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === '#admin' || window.location.pathname.startsWith('/admin')) {
        setCurrentView('admin')
      } else if (window.location.hash === '#success' || window.location.pathname.startsWith('/order-success')) {
        setCurrentView('success')
      } else {
        setCurrentView('store')
      }
    }

    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault()
        navigateToAdmin()
      }
    }

    window.addEventListener('hashchange', handleHash)
    window.addEventListener('popstate', handleHash)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('hashchange', handleHash)
      window.removeEventListener('popstate', handleHash)
      window.removeEventListener('keydown', handleKey)
    }
  }, [])

  const navigateToAdmin = () => {
    window.location.hash = 'admin'
    setCurrentView('admin')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const navigateToStore = () => {
    window.location.hash = ''
    setCurrentView('store')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleOrderSuccess = (orderData) => {
    setLatestOrder(orderData)
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('mangogarden_last_order', JSON.stringify(orderData))
      }
    } catch (e) {
      console.warn('sessionStorage save error:', e)
    }
    window.location.hash = 'success'
    setCurrentView('success')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <CmsProvider>
      {currentView === 'admin' ? (
        <AdminApp onNavigateStore={navigateToStore} />
      ) : currentView === 'success' ? (
        <OrderSuccessPage order={latestOrder} onReturnHome={navigateToStore} />
      ) : (
        <Storefront onOpenAdmin={navigateToAdmin} onOrderSuccess={handleOrderSuccess} />
      )}
    </CmsProvider>
  )
}
