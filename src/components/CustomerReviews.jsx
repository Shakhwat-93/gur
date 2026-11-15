import React, { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Star, ShieldCheck, ZoomIn, X, Camera } from 'lucide-react'
import { customerReviews } from '../data.js'

const bnDigits = '০১২৩৪৫৬৭৮৯'
const toBn = (n) => String(n).replace(/\d/g, (d) => bnDigits[d])

export default function CustomerReviews() {
  const railRef = useRef(null)
  const [zoomItem, setZoomItem] = useState(null)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (!zoomItem) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setZoomItem(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [zoomItem])

  // Track active scroll dot
  useEffect(() => {
    const el = railRef.current
    if (!el) return
    const handleScroll = () => {
      const cardWidth = el.firstElementChild?.clientWidth || 280
      const scrollPos = el.scrollLeft
      const newIdx = Math.round(scrollPos / (cardWidth + 14))
      setActiveIndex(Math.min(customerReviews.length - 1, Math.max(0, newIdx)))
    }
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollRail = (dir) => {
    const el = railRef.current
    if (!el) return
    const step = Math.min(320, el.clientWidth * 0.8)
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  return (
    <section className="testimonials-section" id="reviews">
      <div className="container">
        <div className="sec-header">
          <h2 className="sec-title">যারা খেয়েছেন</h2>
          <p className="sec-subtitle">
            ইনবক্স আর কমেন্টে আসা রিভিউ, কোনো এডিট ছাড়া · {toBn(customerReviews.length)}টি আসল কাস্টমার স্ক্রিনশট
          </p>
        </div>

        {/* Carousel & Controls */}
        <div className="reviews-carousel-wrap">
          <div className="reviews-rail" ref={railRef}>
            {customerReviews.map((rev) => (
              <article className="review-phone-card" key={rev.id}>
                <div
                  className="review-card-media"
                  onClick={() => setZoomItem(rev)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${rev.customer} এর রিভিউ বড় করে দেখুন`}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setZoomItem(rev) }}
                >
                  <img
                    src={rev.image}
                    alt={`গ্রাহক রিভিউ: ${rev.customer}`}
                    loading="lazy"
                    decoding="async"
                    style={{ objectPosition: rev.photoFocus || 'center center' }}
                  />
                  <span className="review-channel-tag">
                    <Camera size={12} /> {rev.badge || rev.channel}
                  </span>
                  <span className="review-zoom-btn">
                    <ZoomIn size={12} /> বড় করুন
                  </span>
                </div>

                <div className="review-card-body">
                  <div className="review-card-stars" aria-label="৫ স্টার রেটিং">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star key={i} size={14} fill="#E9A23B" color="#E9A23B" />
                    ))}
                  </div>
                  <p className="review-quote-text">“{rev.quote}”</p>
                  <div className="review-customer-info">
                    <span>{rev.customer}</span> · <span style={{ color: '#B8231C' }}>✓ {rev.channel}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Dots Indicator */}
          <div className="reviews-dots-row" aria-hidden="true">
            {customerReviews.map((_, idx) => (
              <span
                key={idx}
                className={`review-dot ${activeIndex === idx ? 'active' : ''}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {zoomItem && (
        <div
          className="review-lightbox-modal"
          onClick={() => setZoomItem(null)}
          role="dialog"
          aria-modal="true"
          aria-label="গ্রাহক রিভিউ স্ক্রিনশট"
        >
          <div className="review-lightbox-card" onClick={(e) => e.stopPropagation()}>
            <div className="review-lightbox-head">
              <div>
                <strong>{zoomItem.channel} · {zoomItem.badge}</strong>
                <p style={{ fontSize: '12px', color: '#7B6A5B' }}>{zoomItem.customer}</p>
              </div>
              <button
                type="button"
                style={{ padding: '6px', borderRadius: '50%', background: '#F5ECDD', color: '#2A1A12' }}
                onClick={() => setZoomItem(null)}
                aria-label="বন্ধ করুন"
              >
                <X size={20} />
              </button>
            </div>
            <div className="review-lightbox-img-wrap">
              <img src={zoomItem.image} alt={zoomItem.quote} />
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
