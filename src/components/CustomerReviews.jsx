import React, { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Star, ShieldCheck, ZoomIn, X, MessageCircle, Camera } from 'lucide-react'
import { customerReviews } from '../data.js'

const bnDigits = '০১২৩৪৫৬৭৮৯'
const toBn = (n) => String(n).replace(/\d/g, (d) => bnDigits[d])

export default function CustomerReviews() {
  const railRef = useRef(null)
  const [zoomItem, setZoomItem] = useState(null)

  useEffect(() => {
    if (!zoomItem) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setZoomItem(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [zoomItem])

  const scrollRail = (dir) => {
    const el = railRef.current
    if (!el) return
    const step = Math.min(380, el.clientWidth * 0.85)
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  return (
    <section className="section reviews-band" id="reviews">
      <div className="container">
        <div className="sec-head reveal">
          <span className="eyebrow">💬 ভেরিফাইড ক্রেতা অভিজ্ঞতা</span>
          <h2>গ্রাহকদের ভালোবাসা ও আসল স্ক্রিনশট</h2>
          <p>হোয়াটসঅ্যাপ ও মেসেঞ্জারে পাঠানো সম্মানিত ক্রেতাদের হাতে পাওয়া পার্সেলের ছবি ও মতামত</p>
        </div>

        <div className="reviews-top-controls reveal">
          <div className="reviews-badges">
            <span className="reviews-pill">
              <ShieldCheck size={15} /> ১০০% আসল কাস্টমার প্রুফ
            </span>
            <span className="reviews-pill gold">
              <Star size={15} fill="currentColor" /> {toBn(customerReviews.length)}টি যাচাইকৃত রিভিউ
            </span>
          </div>

          <div className="reviews-nav-arrows">
            <button
              type="button"
              className="rail-arrow-btn"
              onClick={() => scrollRail(-1)}
              aria-label="আগের রিভিউগুলো দেখুন"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              className="rail-arrow-btn"
              onClick={() => scrollRail(1)}
              aria-label="পরের রিভিউগুলো দেখুন"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="reviews-rail" ref={railRef}>
          {customerReviews.map((rev, idx) => (
            <article className="proof-card reveal" key={rev.id}>
              {rev.hasPhotoHighlight ? (
                <button
                  type="button"
                  className="proof-shot-btn"
                  onClick={() => setZoomItem(rev)}
                  aria-label={`${rev.customer} এর আনবক্সিং ছবি বড় করে দেখুন`}
                >
                  <img
                    src={rev.image}
                    alt={`ম্যাংগো গার্ডেন গুড় কাস্টমার আনবক্সিং ${idx + 1}`}
                    loading="lazy"
                    decoding="async"
                    style={{ objectPosition: rev.photoFocus || 'center center' }}
                    className="proof-photo-zoomed"
                  />
                  <span className="proof-channel-pill">
                    <Camera size={12} /> {rev.badge}
                  </span>
                  <span className="proof-zoom-pill">
                    <ZoomIn size={13} /> মূল চ্যাট দেখুন
                  </span>
                </button>
              ) : (
                <div className="proof-quote-stage">
                  <div className="proof-quote-stage-top">
                    <span className="proof-stage-badge">{rev.badge}</span>
                    <div className="proof-stars" aria-label="৫ স্টার রেটিং">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <Star key={i} size={13} fill="#E9B44C" color="#E9B44C" />
                      ))}
                    </div>
                  </div>
                  <div className="proof-big-mark" aria-hidden="true">“</div>
                  <p className="proof-stage-quote">{rev.quote}</p>
                  <button
                    type="button"
                    className="proof-view-shot-chip"
                    onClick={() => setZoomItem(rev)}
                  >
                    <MessageCircle size={13} />
                    <span>আসল স্ক্রিনশট দেখুন</span>
                    <ZoomIn size={13} />
                  </button>
                </div>
              )}

              <div className="proof-card-body">
                {rev.hasPhotoHighlight ? (
                  <>
                    <div className="proof-card-head">
                      <span className="proof-badge">{rev.channel}</span>
                      <div className="proof-stars" aria-label="৫ স্টার রেটিং">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <Star key={i} size={13} fill="#D9822B" color="#D9822B" />
                        ))}
                      </div>
                    </div>
                    <p className="proof-quote">“{rev.quote}”</p>
                    <small className="proof-author">{rev.customer}</small>
                  </>
                ) : (
                  <div className="proof-card-foot-compact">
                    <small className="proof-author">{rev.customer}</small>
                    <span className="proof-verified-mini">✓ {rev.channel}</span>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>

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
                <small>{zoomItem.customer}</small>
              </div>
              <button
                type="button"
                className="lightbox-close-btn"
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
