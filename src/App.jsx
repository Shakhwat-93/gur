import { useEffect, useRef, useState } from 'react'
import { ShieldCheck, Truck, Gift, CalendarCheck, Check, ShoppingBag, Sparkles, ArrowRight } from 'lucide-react'
import {
  BRAND_IMAGES,
  DELIVERY_CHARGE,
  DELIVERY_START_NOTICE,
  FREE_BONUS_MIN_KG,
  FREE_BONUS_ITEM_NAME,
  combos,
  gurPrices,
  craftSteps,
  orderOptions
} from './data.js'
import { submitOrder } from './supabase.js'
import { CmsProvider, useCms } from './context/CmsContext.jsx'
import AdminApp from './admin/AdminApp.jsx'
import OrderSuccessPage from './pages/OrderSuccessPage.jsx'
import CustomerReviews from './components/CustomerReviews.jsx'
import { fetchClientIp, trackMessageAction } from './lib/tracking.js'
import { normalizeBdPhone, isValidBdPhone } from './lib/phoneNormalizer.js'
import { mountHeroChoreography, observeStaggerGroup, observeSvgDraw, pulseElement } from './lib/motion.js'

/* ---------- helpers ---------- */
const bnDigits = '০১২৩৪৫৬৭৮৯'
const toBn = (n) => String(n).replace(/\d/g, (d) => bnDigits[d])
const taka = (n) => toBn(Number(n).toLocaleString('en-IN'))

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal')
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            e.target.setAttribute('data-revealed', 'true')
            io.unobserve(e.target)
          }
        }),
      { threshold: 0.08, rootMargin: '0px 0px 80px 0px' }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}

const scrollToSection = (id) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

/* ---------- sections ---------- */
function Header({ totalItems, grandTotal, cartBadgeRef }) {
  return (
    <>
      <div className="top-strip">
        📦 {DELIVERY_START_NOTICE} · সারা বাংলাদেশে ক্যাশ অন ডেলিভারি
      </div>
      <header className="header">
        <div className="container header-inner">
          <a href="#top" className="brand">
            <img src={BRAND_IMAGES.logo} alt="ম্যাংগো গার্ডেন লোগো" className="brand-logo" />
            <div className="brand-info">
              <span className="brand-title">ম্যাংগো গার্ডেন</span>
              <span className="brand-tag">খাঁটি খেজুরের গুড়</span>
            </div>
          </a>

          <nav className="nav-links" aria-label="প্রাথমিক নেভিগেশন">
            <a href="#combo">৯৯০৳ কম্বো</a>
            <a href="#pricing">গুড়ের তালিকা</a>
            <a href="#craft">প্রস্তুতি</a>
            <a href="#reviews">রিভিউ</a>
            <a href="#order">অর্ডার ফর্ম</a>
          </nav>

          <div className="header-actions">
            <a
              href="https://www.facebook.com/mangogardenbd1"
              target="_blank"
              rel="noopener noreferrer"
              className="header-fb-btn"
              aria-label="ম্যাংগো গার্ডেন ফেসবুক পেজ"
              title="আমাদের ফেসবুক পেজ"
              onClick={() => trackMessageAction({ channel: 'facebook', placement: 'header' })}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </a>
            <button
              type="button"
              ref={cartBadgeRef}
              className="header-cart-btn"
              onClick={() => scrollToSection('order')}
            >
              <ShoppingBag size={16} />
              <span>অর্ডার ({toBn(totalItems)}) · ৳{taka(grandTotal)}</span>
            </button>
          </div>
        </div>
      </header>
    </>
  )
}

function Hero({ onPickAndOrder }) {
  const heroRef = useRef(null)

  useEffect(() => {
    return mountHeroChoreography(heroRef.current)
  }, [])

  return (
    <section className="hero-section" id="top" ref={heroRef}>
      {/* Botanical Palm & Nectar SVG Linework (animated by Anime.js createDrawable) */}
      <svg className="hero-botanical-svg" viewBox="0 0 1440 620" fill="none" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <path
          className="hero-botanical-path"
          d="M-40 520 C 210 380, 420 560, 740 310 C 980 120, 1210 210, 1480 70"
          stroke="url(#heroGoldLine)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          className="hero-botanical-path"
          d="M960 640 C 1020 430, 1180 280, 1440 240"
          stroke="url(#heroGoldLine)"
          strokeWidth="1.5"
          strokeDasharray="6 6"
        />
        <defs>
          <linearGradient id="heroGoldLine" x1="0" y1="0" x2="1440" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E9B44C" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#E9B44C" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#D9822B" stopOpacity="0.2" />
          </linearGradient>
        </defs>
      </svg>

      <div className="container hero-grid">
        <div className="hero-copy">
          <span className="hero-pill">
            <Sparkles size={14} /> ম্যাংগো গার্ডেন · শীতের খাঁটি খেজুর গুড়
          </span>
          <h1 className="hero-stagger">
            গাছির খাঁটি রসে তৈরি <span className="hero-gold">আসল খেজুরের গুড়</span>
          </h1>
          <p className="hero-lead hero-stagger">
            মাত্র <b>৯৯০ টাকায়</b> পাচ্ছেন ৫ ধরনের খাঁটি খেজুরের গুড় (মোট ২.৫ কেজি) — সাথে হোম ডেলিভারি চার্জ একেবারেই ফ্রি!
          </p>

          <div className="hero-highlights hero-stagger">
            <span className="hero-chip">🪔 ৯৯০৳ কম্বো (২.৫ কেজি)</span>
            <span className="hero-chip palm">🚚 ফ্রি হোম ডেলিভারি</span>
            <span className="hero-chip">💠 ৩ কেজিতে ৫০০ গ্রাম ঝোলা গুড় ফ্রি</span>
          </div>

          <div className="hero-ctas hero-stagger">
            <button type="button" className="btn btn-lg shine" onClick={() => onPickAndOrder('gur-combo-990')}>
              ৯৯০৳ কম্বো অর্ডার করুন <ArrowRight size={18} />
            </button>
            <a href="#pricing" className="btn btn-outline-gold btn-lg">
              প্রতি কেজির তালিকা দেখুন
            </a>
          </div>
        </div>

        <div className="hero-visual-stage">
          <div className="hero-arch-card">
            <img
              src={BRAND_IMAGES.heroPatali}
              alt="খেজুর বাগানের সামনে খাঁটি গোল পাটালি গুড়"
              loading="eager"
              decoding="async"
            />
            <div className="hero-arch-scrim" />
          </div>

          <div className="hero-date-stamp hero-float-card">
            📦 {DELIVERY_START_NOTICE}
          </div>

          <a href="#combo" className="hero-combo-floating-glass hero-float-card" aria-label="৯৯০ টাকার ৫ ধরনের গুড় কম্বো দেখুন">
            <div className="hero-glass-left">
              <div className="hero-swatch-stack">
                <img src={BRAND_IMAGES.combo990} alt="৫ ধরনের গুড় কম্বো" />
                <img src="/img/IMG_8df5a126-73c7-4a1b-b32d-5c8caf3d6f24.jpg.jpeg" alt="লালি ও ঝোলা গুড়" />
              </div>
              <div className="hero-glass-meta">
                <strong>৫ ধরনের গুড় কম্বো (২.৫ কেজি)</strong>
                <small>✓ ফ্রি হোম ডেলিভারি</small>
              </div>
            </div>
            <span className="hero-glass-price">৳{taka(990)}</span>
          </a>
        </div>
      </div>
    </section>
  )
}

function TrustStrip() {
  const pillars = [
    { icon: ShieldCheck, title: '১০০% খাঁটি রস', desc: 'চিনি ও কেমিক্যালমুক্ত নিশ্চয়তা' },
    { icon: Truck, title: 'ফ্রি ডেলিভারি', desc: '৯৯০৳ কম্বোতে কোনো চার্জ নেই' },
    { icon: Gift, title: '৩ কেজিতে ফ্রি গিফট', desc: '৫০০ গ্রাম ঝোলা গুড় একদম ফ্রি' },
    { icon: CalendarCheck, title: '১৫ নভেম্বর ডেলিভারি', desc: 'ইনশাআল্লাহ · ক্যাশ অন ডেলিভারি' },
  ]
  return (
    <section className="trust-section">
      <div className="container">
        <div className="trust-grid">
          {pillars.map((item) => {
            const Icon = item.icon
            return (
              <div className="trust-item" key={item.title}>
                <div className="trust-icon-box">
                  <Icon size={20} strokeWidth={2.1} />
                </div>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.desc}</small>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function Combos({ comboQty, onPickAndOrder }) {
  const combo = combos[0]
  const [activeIdx, setActiveIdx] = useState(0)
  const details = combo.itemDetails || []

  return (
    <section className="section" id="combo">
      <div className="container">
        <div className="sec-head reveal">
          <span className="eyebrow">🪔 সিগনেচার কম্বো প্যাকেজ</span>
          <h2>মাত্র ৯৯০ টাকায় ৫ ধরনের খাঁটি খেজুরের গুড়</h2>
          <p>প্রতিটি আইটেমে ট্যাপ করে স্বাদ ও বিবরণ দেখুন · সর্বমোট ২.৫ কেজি · <b>ফ্রি হোম ডেলিভারি</b></p>
        </div>

        <article className="combo-showcase reveal">
          <div className="combo-media-col">
            <img src={combo.image} alt={combo.title} loading="lazy" decoding="async" />
            <div className="combo-media-vignette" />
            <span className="combo-float-tag">📦 {DELIVERY_START_NOTICE}</span>
          </div>

          <div className="combo-info-col">
            <div>
              <div className="combo-badges">
                <span className="badge-free">🚚 হোম ডেলিভারি সম্পূর্ণ ফ্রি</span>
                <span className="badge-weight">📦 সর্বমোট ২.৫ কেজি</span>
              </div>
              <h3>প্যাকেজে যে ৫টি গুড় থাকছে —</h3>

              <div className="combo-interactive-list">
                {details.map((item, idx) => {
                  const isOpen = activeIdx === idx
                  return (
                    <button
                      type="button"
                      key={item.name}
                      className={`combo-item-tab ${isOpen ? 'active' : ''}`}
                      onClick={() => setActiveIdx(idx)}
                      aria-expanded={isOpen}
                    >
                      <div className="combo-tab-head">
                        <span className="combo-tab-left">
                          <span className="combo-check-dot"><Check size={13} strokeWidth={3} /></span>
                          <span>{item.name}</span>
                        </span>
                        <span className="combo-weight-pill">{item.weight}</span>
                      </div>
                      {isOpen && (
                        <div className="combo-tab-detail">
                          <div>{item.note}</div>
                          <span className="combo-tab-pairing">🍯 {item.pairing}</span>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="combo-buy-bar">
              <div className="combo-price-block">
                <small>৫ ধরনের গুড় (২.৫ কেজি) + ফ্রি ডেলিভারি</small>
                <div className="combo-price-num">৳{taka(combo.price)}</div>
              </div>
              <button
                type="button"
                className="btn btn-lg shine"
                onClick={() => onPickAndOrder(combo.id)}
              >
                {comboQty > 0 ? `✓ কম্বো নির্বাচিত (${toBn(comboQty)}) · অর্ডার করুন →` : '৯৯০৳ কম্বো অর্ডার করুন →'}
              </button>
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}

function GurCatalog({ selected, looseKg, onAddItem, onUpdateQty, onGoOrder }) {
  const gridRef = useRef(null)
  useEffect(() => observeStaggerGroup(gridRef.current, '.gur-card'), [])

  const remainingForFree = Math.max(0, FREE_BONUS_MIN_KG - looseKg)
  const progressRatio = Math.min(1, looseKg / FREE_BONUS_MIN_KG)

  return (
    <section className="section" id="pricing">
      <div className="container">
        <div className="sec-head reveal">
          <span className="eyebrow">💰 ম্যাংগো গার্ডেনের মূল্য তালিকা</span>
          <h2>খাঁটি খেজুরের গুড় (প্রতি কেজির মূল্য)</h2>
          <p>আপনার পছন্দ অনুযায়ী ১ কেজি বা মিক্স করে ৩ কেজি+ অর্ডার করুন</p>
        </div>

        <div className="offer-banner reveal">
          <div className="offer-banner-top">
            <div className="offer-banner-main">
              <div className="offer-banner-icon">
                <Gift size={22} />
              </div>
              <div>
                <strong>💠 বিশেষ অফার: ৩ কেজি নিলে ৫০০ গ্রাম ঝোলা গুড় একদম ফ্রি!</strong>
                <small>কার্ড থেকে পছন্দের গুড় কার্টে যোগ করলেই সাথে সাথে ফ্রি অফার আনলক হবে</small>
              </div>
            </div>
            <span className="offer-date-pill">📦 {DELIVERY_START_NOTICE}</span>
          </div>

          <div className="catalog-bonus-bar">
            <div className="catalog-bonus-row">
              <span>
                {looseKg >= FREE_BONUS_MIN_KG
                  ? '🎉 অভিনন্দন! ৩ কেজি+ হওয়ায় ৫০০ গ্রাম ঝোলা গুড় একদম ফ্রি আনলক হয়েছে!'
                  : looseKg > 0
                  ? `আর ${toBn(remainingForFree)} কেজি যোগ করলেই ৫০০ গ্রাম ঝোলা গুড় ফ্রি পাবেন`
                  : 'এখনো কোনো কেজি আইটেম যোগ করা হয়নি (৩ কেজি = ফ্রি গিফট)'}
              </span>
              <span>{toBn(Math.min(looseKg, FREE_BONUS_MIN_KG))}/{toBn(FREE_BONUS_MIN_KG)} কেজি</span>
            </div>
            <div className="catalog-bonus-track">
              <div className="catalog-bonus-fill" style={{ transform: `scaleX(${progressRatio})` }} />
            </div>
          </div>
        </div>

        <div className="gur-grid" ref={gridRef}>
          {gurPrices.map((g) => {
            const qty = selected[g.id] || 0
            const imgWrapClass = [
              'gur-card-img-wrap',
              g.contain ? 'is-contain' : '',
              g.cropCorner ? 'is-crop-corner' : '',
              g.zoomFocus ? 'is-zoom-focus' : '',
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <article
                className={`gur-card stagger-card ${g.featured || qty > 0 ? 'featured' : ''}`}
                key={g.id}
              >
                <div className={imgWrapClass}>
                  <img
                    src={g.image}
                    alt={g.name}
                    loading="lazy"
                    decoding="async"
                    style={g.pos && !g.cropCorner && !g.zoomFocus ? { objectPosition: g.pos } : undefined}
                  />
                  <div className="gur-img-scrim" />
                  <span className="gur-tag-pill">{g.tag}</span>
                  {qty > 0 ? (
                    <button type="button" className="gur-pop-pill gur-in-cart-pill" onClick={onGoOrder}>
                      ✓ কার্টে ({toBn(qty)}) →
                    </button>
                  ) : (
                    g.featured && <span className="gur-pop-pill">★ জনপ্রিয়</span>
                  )}
                  {g.pairing && <span className="gur-pairing-badge">🍽️ {g.pairing}</span>}
                </div>

                <div className="gur-card-body">
                  <div>
                    <h3>{g.name}</h3>
                    <p>{g.desc}</p>
                  </div>
                  <div className="gur-card-foot">
                    <span className="gur-price">
                      ৳{taka(g.price)} <small>/{g.unit}</small>
                    </span>
                    {qty > 0 ? (
                      <div className="mini-stepper">
                        <button
                          type="button"
                          onClick={() => onUpdateQty(g.id, qty - 1, 20)}
                          aria-label={`${g.name} কমান`}
                        >
                          −
                        </button>
                        <span>{toBn(qty)} কেজি</span>
                        <button
                          type="button"
                          onClick={() => onUpdateQty(g.id, qty + 1, 20)}
                          aria-label={`${g.name} বাড়ান`}
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-sm btn-palm"
                        onClick={() => onAddItem(g.id)}
                      >
                        + কার্টে দিন
                      </button>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function CraftAndStory() {
  const stepsGridRef = useRef(null)
  const drawSvgRef = useRef(null)

  useEffect(() => {
    const cleanStagger = observeStaggerGroup(stepsGridRef.current, '.craft-step-card')
    const cleanDraw = observeSvgDraw(drawSvgRef.current)
    return () => {
      cleanStagger()
      cleanDraw()
    }
  }, [])

  return (
    <section className="section craft-band" id="craft">
      <div className="container">
        <div className="sec-head reveal">
          <span className="eyebrow">🌴 গাছ থেকে আপনার টেবিল</span>
          <h2>কীভাবে তৈরি হয় ম্যাংগো গার্ডেনের খাঁটি গুড়</h2>
          <p>ভোরের কুয়াশা ভেদ করে কাঁচা রস সংগ্রহ থেকে হাইজেনিক প্যাকিং পর্যন্ত প্রতিটি ধাপে শতভাগ বিশুদ্ধতা</p>
        </div>

        <div className="craft-steps-shell" ref={stepsGridRef}>
          <svg
            ref={drawSvgRef}
            className="craft-svg-connector"
            viewBox="0 0 920 36"
            fill="none"
            aria-hidden="true"
          >
            <path
              className="draw-step-line"
              d="M 10 18 Q 230 2, 460 18 T 910 18"
              stroke="#D9822B"
              strokeWidth="2.4"
              strokeDasharray="6 6"
              strokeLinecap="round"
            />
          </svg>

          <div className="craft-grid">
            {craftSteps.map((s) => (
              <div className="craft-step-card stagger-card" key={s.step}>
                <div className="craft-num-circle">{s.step}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <article className="story-card reveal" id="story">
          <div className="story-photo-wrap">
            <img
              src={BRAND_IMAGES.makerStory}
              alt="খেজুর গুড় তৈরি করছেন ম্যাংগো গার্ডেনের কারিগর"
              loading="lazy"
              decoding="async"
            />
            <div className="story-caption-badge">
              🔥 সরাসরি বাগানের চুলা থেকে সদ্য তৈরি খাঁটি খেজুরের পাটালি গুড়
            </div>
          </div>

          <div className="story-content">
            <span className="eyebrow" style={{ alignSelf: 'flex-start' }}>🌿 শতভাগ খাঁটি নিশ্চয়তা</span>
            <h3>গাছির নিজের তত্ত্বাবধানে সদ্য গড়া প্রতিটি পাটালি</h3>
            <p>
              আমাদের প্রতিটি ব্যাচ তৈরি হয় ভোরের প্রথম সংগ্রহ করা টাটকা রসে। চিনি, হাইড্রোজ বা কৃত্রিম রঙ ছাড়াই শুধু কাঠের আগুনে ধীরে ধীরে জ্বাল দিয়ে অটুট রাখা হয় আসল খেজুর রসের ঘ্রাণ।
            </p>

            <div className="story-pillars">
              <div className="story-pillar">
                <span className="story-pillar-icon">🍯</span>
                <div>
                  <strong>ল্যাব ও স্বাদ পরীক্ষিত বিশুদ্ধতা</strong>
                  <small>হাতে পাওয়ার পর স্বাদ ও ঘ্রাণ যাচাই করে মূল্য পরিশোধের সুবিধা।</small>
                </div>
              </div>
              <div className="story-pillar">
                <span className="story-pillar-icon">🛡️</span>
                <div>
                  <strong>ফুড-গ্রেড জার ও ফয়েল প্যাকিং</strong>
                  <small>ডেলিভারির পথে গলে বা ভেঙে যাওয়ার ভয় নেই, সারা দেশে নিরাপদ ডেলিভারি।</small>
                </div>
              </div>
              <div className="story-pillar">
                <span className="story-pillar-icon">📦</span>
                <div>
                  <strong>{DELIVERY_START_NOTICE}</strong>
                  <small>মৌসুমের শুরুতেই তাজা ব্যাচ পেতে এখনই প্রি-অর্ডার কনফার্ম করুন।</small>
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}

function OrderForm({ selected, onToggleItem, onUpdateQty, onResetCart, onOrderSuccess }) {
  const { refreshAll } = useCms() || {}
  const [form, setForm] = useState({ name: '', phone: '', address: '' })
  const [err, setErr] = useState({})
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [orderErr, setOrderErr] = useState('')

  const comboOption = orderOptions.find((o) => o.isCombo)
  const kgOptions = orderOptions.filter((o) => !o.isCombo)

  const comboQty = selected[comboOption.id] || 0
  const looseEntries = kgOptions
    .map((opt) => ({ opt, qty: selected[opt.id] || 0 }))
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

  const submit = async (e) => {
    e.preventDefault()
    setOrderErr('')

    if (!hasItems) {
      setOrderErr('অনুগ্রহ করে অন্তত একটি প্যাকেজ বা গুড় নির্বাচন করুন')
      return
    }

    const er = {}
    if (form.name.trim().length < 2) er.name = 'আপনার নাম লিখুন'
    const normalizedPhone = normalizeBdPhone(form.phone)
    if (!isValidBdPhone(normalizedPhone)) er.phone = 'সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন'
    if (form.address.trim().length < 8) er.address = 'পূর্ণ ঠিকানা লিখুন'
    setErr(er)
    if (Object.keys(er).length) return

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
        try {
          refreshAll()
        } catch (err) {
          // silent
        }
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
    <section className="section" id="order">
      <div className="container">
        <div className="sec-head reveal">
          <span className="eyebrow">🛒 অর্ডার ফর্ম</span>
          <h2>পছন্দের গুড় বেছে অর্ডার কনফার্ম করুন</h2>
          <p>ক্যাশ অন ডেলিভারি · {DELIVERY_START_NOTICE}</p>
        </div>

        <form className="checkout-grid reveal" onSubmit={submit} noValidate>
          <div className="checkout-panel">
            <div className="opt-header-row">
              <span className="opt-header-title">১. প্যাকেজ ও গুড় নির্বাচন করুন</span>
              <span className="opt-limit-pill">একাধিক নেওয়া যাবে</span>
            </div>

            <div className="opt-group-title">
              <span>🪔 বিশেষ প্যাকেজ (হোম ডেলিভারি ফ্রি)</span>
            </div>
            <div className="opts">
              <div className={`opt-row ${comboQty > 0 ? 'active' : ''}`}>
                <button
                  type="button"
                  className="opt-main-btn"
                  onClick={() => onToggleItem(comboOption.id)}
                  aria-pressed={comboQty > 0}
                >
                  <span className="chk">{comboQty > 0 ? '✓' : ''}</span>
                  <span className="opt-thumb-box">
                    <img src={comboOption.image} alt={comboOption.label} className="opt-thumb" />
                  </span>
                  <span className="opt-text">
                    <b>{comboOption.label}</b>
                    <small className="free">হোম ডেলিভারি চার্জ একেবারেই ফ্রি!</small>
                  </span>
                </button>
                <div className="opt-right-ctrl">
                  <span className="opt-price">৳{taka(comboOption.price)}</span>
                  {comboQty > 0 && (
                    <div className="mini-stepper">
                      <button
                        type="button"
                        onClick={() => onUpdateQty(comboOption.id, comboQty - 1, comboOption.max)}
                        aria-label="প্যাকেজ কমান"
                      >
                        −
                      </button>
                      <span>{toBn(comboQty)} প্যাক</span>
                      <button
                        type="button"
                        onClick={() => onUpdateQty(comboOption.id, comboQty + 1, comboOption.max)}
                        aria-label="প্যাকেজ বাড়ান"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="opt-group-title">
              <span>🍯 প্রতি কেজির খাঁটি খেজুরের গুড়</span>
              <span>নির্বাচিত: {toBn(looseKg)} কেজি</span>
            </div>

            <div className={`bonus-tracker ${hasFreeJholaBonus ? 'unlocked' : ''}`}>
              <div className="bonus-tracker-text">
                <span>
                  {hasFreeJholaBonus
                    ? '🎉 অভিনন্দন! ৩ কেজি+ গুড়ে ৫০০ গ্রাম ঝোলা গুড় একদম ফ্রি যুক্ত হয়েছে!'
                    : looseKg > 0
                    ? `💠 আর ${toBn(FREE_BONUS_MIN_KG - looseKg)} কেজি নিলেই ৫০০ গ্রাম ঝোলা গুড় ফ্রি!`
                    : '💠 ৩ কেজি নিলে ৫০০ গ্রাম ঝোলা গুড় একদম ফ্রি!'}
                </span>
                <span>{toBn(Math.min(looseKg, FREE_BONUS_MIN_KG))}/{toBn(FREE_BONUS_MIN_KG)} কেজি</span>
              </div>
              <div className="bonus-progress-track">
                <div
                  className="bonus-progress-fill"
                  style={{ transform: `scaleX(${progressRatio})` }}
                />
              </div>
            </div>

            <div className="opts">
              {kgOptions.map((opt) => {
                const qty = selected[opt.id] || 0
                const isSelected = qty > 0
                const thumbClass = [
                  'opt-thumb',
                  opt.contain ? 'is-contain' : '',
                  opt.cropCorner ? 'is-crop' : '',
                  opt.zoomFocus ? 'is-zoom' : ''
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <div className={`opt-row ${isSelected ? 'active' : ''}`} key={opt.id}>
                    <button
                      type="button"
                      className="opt-main-btn"
                      onClick={() => onToggleItem(opt.id)}
                      aria-pressed={isSelected}
                    >
                      <span className="chk">{isSelected ? '✓' : ''}</span>
                      <span className="opt-thumb-box">
                        <img src={opt.image} alt={opt.label} className={thumbClass} loading="lazy" />
                      </span>
                      <span className="opt-text">
                        <b>{opt.label}</b>
                        <small>{opt.sub}</small>
                      </span>
                    </button>
                    <div className="opt-right-ctrl">
                      <span className="opt-price">
                        ৳{taka(opt.price)}<small>/কেজি</small>
                      </span>
                      <div className="mini-stepper">
                        <button
                          type="button"
                          onClick={() => onUpdateQty(opt.id, qty - 1, opt.max)}
                          disabled={qty <= 0}
                          aria-label={`${opt.label} কমান`}
                        >
                          −
                        </button>
                        <span>{toBn(qty)} কেজি</span>
                        <button
                          type="button"
                          onClick={() => onUpdateQty(opt.id, qty + 1, opt.max)}
                          aria-label={`${opt.label} বাড়ান`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="checkout-panel checkout-sticky">
            <div className="opt-header-row">
              <span className="opt-header-title">২. আপনার ডেলিভারি ঠিকানা</span>
            </div>

            <div className="delivery-date-banner">
              📦 {DELIVERY_START_NOTICE}
            </div>

            <div className="field">
              <label className="lbl" htmlFor="name">আপনার নাম</label>
              <input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="যেমন: রহিম উদ্দিন" />
              {err.name && <span className="err">{err.name}</span>}
            </div>
            <div className="field">
              <label className="lbl" htmlFor="phone">মোবাইল নম্বর</label>
              <input id="phone" inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01XXXXXXXXX" />
              {err.phone && <span className="err">{err.phone}</span>}
            </div>
            <div className="field">
              <label className="lbl" htmlFor="address">পূর্ণ ঠিকানা</label>
              <textarea id="address" rows="3" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="বাসা, রোড, থানা, জেলা" />
              {err.address && <span className="err">{err.address}</span>}
            </div>

            <div className="summary">
              {comboQty > 0 && (
                <div>
                  <span>{comboOption.label} ({toBn(comboQty)} প্যাক)</span>
                  <span>৳{taka(comboSubtotal)}</span>
                </div>
              )}
              {looseEntries.map(({ opt, qty }) => (
                <div key={opt.id}>
                  <span>{opt.label} ({toBn(qty)} কেজি)</span>
                  <span>৳{taka(opt.price * qty)}</span>
                </div>
              ))}
              {hasFreeJholaBonus && (
                <div className="free">
                  <span>🎁 {FREE_BONUS_ITEM_NAME}</span>
                  <span>ফ্রি! (৳০)</span>
                </div>
              )}
              {!hasItems && (
                <div style={{ color: '#b3261e' }}>
                  <span>কোনো আইটেম নির্বাচিত নেই</span>
                  <span>৳০</span>
                </div>
              )}
              <div>
                <span>হোম ডেলিভারি চার্জ</span>
                {!hasItems ? (
                  <span>৳০</span>
                ) : delivery === 0 ? (
                  <span className="free">একেবারেই ফ্রি 🎉</span>
                ) : (
                  <span>৳{taka(delivery)}</span>
                )}
              </div>
              <div className="total">
                <span>সর্বমোট</span>
                <span key={total} className="pop">৳{taka(total)}</span>
              </div>
            </div>

            {orderErr && <span className="err" style={{ marginBottom: '12px', textAlign: 'center' }}>{orderErr}</span>}
            <button type="submit" className="btn btn-lg btn-block shine" disabled={loading || !hasItems}>
              {loading ? 'অর্ডার জমা হচ্ছে...' : `অর্ডার কনফার্ম করুন · ৳${taka(total)}`}
            </button>
          </div>
        </form>
      </div>

      {done && (
        <div className="modal" onClick={() => { setDone(false); onResetCart(); }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="check">✓</div>
            <h3>ধন্যবাদ, {form.name}!</h3>
            <p>আপনার অর্ডারটি সফলভাবে জমা হয়েছে। খুব শীঘ্রই <b>{form.phone}</b> নম্বরে কল করে কনফার্ম করা হবে।</p>
            <button className="btn btn-block" onClick={() => { setDone(false); onResetCart(); }}>ঠিক আছে</button>
          </div>
        </div>
      )}
    </section>
  )
}

function FAQ() {
  const qs = [
    ['ডেলিভারি কবে থেকে শুরু হবে?', 'আগামী ১৫ নভেম্বর থেকে ডেলিভারি শুরু হবে, ইনশাআল্লাহ। এখন প্রি-অর্ডার করে রাখলে সিরিয়াল অনুযায়ী দ্রুত ডেলিভারি পাবেন।'],
    ['৯৯০ টাকার বিশেষ প্যাকেজে কী কী থাকছে?', 'মাত্র ৯৯০ টাকায় মোট ২.৫ কেজি গুড়: হাফ কেজি গোল পাটালি, হাফ কেজি ফয়েল পাটালি, হাফ কেজি ঝোলা গুড়, হাফ কেজি দানাদার গুড় এবং হাফ কেজি চকলেট গুড় — সাথে হোম ডেলিভারি চার্জ একেবারেই ফ্রি!'],
    ['৩ কেজি গুড়ের বিশেষ অফারটি কী?', 'প্রতি কেজির মূল্য তালিকা থেকে মোট ৩ কেজি বা তার বেশি গুড় অর্ডার করলে ৫০০ গ্রাম ঝোলা গুড় একদম ফ্রি পাবেন।'],
    ['গুড় কি ১০০% খাঁটি ও চিনিমুক্ত?', 'জ্বি, ম্যাংগো গার্ডেনের প্রতিটি গুড় কোনো প্রকার চিনি, হাইড্রোজ বা ক্ষতিকর কেমিক্যাল ছাড়াই খাঁটি খেজুরের রস থেকে তৈরি।'],
    ['টাকা কীভাবে পরিশোধ করব?', 'সম্পূর্ণ ক্যাশ অন ডেলিভারি — পণ্য হাতে পেয়ে দেখে ডেলিভারি ম্যানকে টাকা দেবেন।'],
  ]
  const [open, setOpen] = useState(0)
  return (
    <section className="section" id="faq">
      <div className="container">
        <div className="sec-head reveal">
          <span className="eyebrow">❓ সাধারণ জিজ্ঞাসা</span>
          <h2>আপনার মনে থাকা প্রশ্ন ও উত্তর</h2>
        </div>
        <div className="faq-wrap">
          <div className="faq reveal">
            {qs.map(([q, a], i) => (
              <div className={`faq-item ${open === i ? 'open' : ''}`} key={q}>
                <button type="button" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
                  <span>{q}</span>
                  <span className="chev">+</span>
                </button>
                <div className="faq-a"><p>{a}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function StickyBar({ totalItems, grandTotal, hasFreeShipping }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const onScroll = () => {
      const order = document.getElementById('order')
      const r = order?.getBoundingClientRect()
      const inOrder = r && r.top < window.innerHeight && r.bottom > 0
      setShow(window.scrollY > 450 && !inOrder)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className={`sticky-bar ${show ? 'show' : ''}`}>
      <div>
        <small>{hasFreeShipping ? '🚚 ফ্রি হোম ডেলিভারি সক্রিয়' : '📦 ১৫ নভেম্বর থেকে ডেলিভারি শুরু'}</small>
        <b>
          {totalItems > 0
            ? `${toBn(totalItems)}টি আইটেম · ৳${taka(grandTotal)}`
            : '৫ ধরনের খাঁটি গুড় · ৳৯৯০'}
        </b>
      </div>
      <button type="button" className="btn shine" onClick={() => scrollToSection('order')}>
        অর্ডার সম্পন্ন করুন
      </button>
    </div>
  )
}

function FloatingFacebook() {
  return (
    <aside aria-label="সোশ্যাল চ্যাট">
      <a
        href="https://www.facebook.com/mangogardenbd1"
        target="_blank"
        rel="noopener noreferrer"
        className="floating-fb"
        aria-label="ফেসবুকে যোগাযোগ করুন"
        title="ম্যাংগো গার্ডেন ফেসবুক পেজ"
        onClick={() => trackMessageAction({ channel: 'facebook', placement: 'floating_widget' })}
      >
        <span className="floating-fb-pulse" />
        <div className="floating-fb-btn">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          <span className="floating-fb-status" />
        </div>
        <span className="floating-fb-text">ফেসবুকে মেসেজ দিন</span>
      </a>
    </aside>
  )
}

function Storefront({ onOpenAdmin, onOrderSuccess }) {
  useReveal()
  const [selected, setSelected] = useState({ 'gur-combo-990': 1 })
  const cartBadgeRef = useRef(null)

  const toggleItem = (id) => {
    setSelected((prev) => {
      const next = { ...prev }
      if ((next[id] || 0) > 0) delete next[id]
      else next[id] = 1
      return next
    })
    pulseElement(cartBadgeRef.current)
  }

  const addItem = (id) => {
    setSelected((prev) => ({
      ...prev,
      [id]: Math.max(1, prev[id] || 0)
    }))
    pulseElement(cartBadgeRef.current)
  }

  const updateQty = (id, qty, max = 20) => {
    setSelected((prev) => {
      const next = { ...prev }
      if (qty <= 0) delete next[id]
      else next[id] = Math.min(max, qty)
      return next
    })
    pulseElement(cartBadgeRef.current)
  }

  const pickAndScrollToOrder = (id) => {
    addItem(id)
    scrollToSection('order')
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
      <Header totalItems={totalItems} grandTotal={grandTotal} cartBadgeRef={cartBadgeRef} />
      <main>
        <Hero onPickAndOrder={pickAndScrollToOrder} />
        <TrustStrip />
        <Combos comboQty={comboQty} onPickAndOrder={pickAndScrollToOrder} />
        <GurCatalog
          selected={selected}
          looseKg={looseKg}
          onAddItem={addItem}
          onUpdateQty={updateQty}
          onGoOrder={() => scrollToSection('order')}
        />
        <CraftAndStory />
        <CustomerReviews />
        <OrderForm
          selected={selected}
          onToggleItem={toggleItem}
          onUpdateQty={updateQty}
          onResetCart={() => setSelected({ 'gur-combo-990': 1 })}
          onOrderSuccess={onOrderSuccess}
        />
        <FAQ />
      </main>
      <footer className="footer">
        <div className="footer-brand">
          <img src={BRAND_IMAGES.logo} alt="ম্যাংগো গার্ডেন লোগো" className="footer-logo" />
          <b>ম্যাংগো গার্ডেন</b>
        </div>
        <p>১০০% খাঁটি খেজুরের গুড় · {DELIVERY_START_NOTICE}</p>
        <div className="footer-links">
          <a
            href="https://www.facebook.com/mangogardenbd1"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-fb-pill"
            onClick={() => trackMessageAction({ channel: 'facebook', placement: 'footer' })}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
            <span>ফেসবুক পেজ ভিজিট করুন</span>
          </a>
        </div>
        <div style={{ margin: '14px 0 8px' }}>
          <button
            type="button"
            onClick={onOpenAdmin}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.45)',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '6px',
              transition: 'color .2s, background .2s'
            }}
            onMouseOver={(e) => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
            onMouseOut={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.background = 'none' }}
            title="অ্যাডমিন প্যানেল (অথবা প্রেস করুন Ctrl+Shift+A)"
          >
            ⚙️ অ্যাডমিন প্যানেল
          </button>
        </div>
        <small>© {toBn(new Date().getFullYear())} ম্যাংগো গার্ডেন · সর্বস্বত্ব সংরক্ষিত</small>
      </footer>
      <FloatingFacebook />
      <StickyBar totalItems={totalItems} grandTotal={grandTotal} hasFreeShipping={comboQty > 0} />
    </>
  )
}

export default function App() {
  const [currentView, setCurrentView] = useState(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash === '#admin' || window.location.pathname.startsWith('/admin')) {
        return 'admin';
      }
      if (window.location.hash === '#success' || window.location.pathname.startsWith('/order-success')) {
        return 'success';
      }
    }
    return 'store';
  });

  const [latestOrder, setLatestOrder] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = sessionStorage.getItem('mangogarden_last_order');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === '#admin' || window.location.pathname.startsWith('/admin')) {
        setCurrentView('admin');
      } else if (window.location.hash === '#success' || window.location.pathname.startsWith('/order-success')) {
        setCurrentView('success');
      } else {
        setCurrentView('store');
      }
    };

    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        navigateToAdmin();
      }
    };

    window.addEventListener('hashchange', handleHash);
    window.addEventListener('popstate', handleHash);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('hashchange', handleHash);
      window.removeEventListener('popstate', handleHash);
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  const navigateToAdmin = () => {
    window.location.hash = 'admin';
    setCurrentView('admin');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToStore = () => {
    window.location.hash = '';
    setCurrentView('store');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOrderSuccess = (orderData) => {
    setLatestOrder(orderData);
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('mangogarden_last_order', JSON.stringify(orderData));
      }
    } catch (e) {
      console.warn('sessionStorage save error:', e);
    }
    window.location.hash = 'success';
    setCurrentView('success');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
  );
}
