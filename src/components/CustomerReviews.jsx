import React, { useEffect, useRef, useState, useLayoutEffect } from 'react'
import { ChevronLeft, ChevronRight, Star, ZoomIn, X, Camera, Hand, Sparkles } from 'lucide-react'
import { gsap } from 'gsap'
import { Draggable } from 'gsap/Draggable'
import { InertiaPlugin } from 'gsap/InertiaPlugin'
import { Flip } from 'gsap/Flip'
import { customerReviews } from '../data.js'

gsap.registerPlugin(Draggable, InertiaPlugin, Flip)

const bnDigits = '০১২৩৪৫৬৭৮৯'
const toBn = (n) => String(n).replace(/\d/g, (d) => bnDigits[d])

export default function CustomerReviews() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [zoomItem, setZoomItem] = useState(null)
  const [isDesktop, setIsDesktop] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 768 : false))
  const [isPaused, setIsPaused] = useState(false)

  const topCardRef = useRef(null)
  const draggableInstanceRef = useRef(null)
  const progressFillRef = useRef(null)
  const progressTweenRef = useRef(null)
  const total = customerReviews.length

  // Screen size detection
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768)
    }
    window.addEventListener('resize', handleResize, { passive: true })
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Keyboard navigation & modal close
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setZoomItem(null)
      if (e.key === 'ArrowLeft') prevSlide()
      if (e.key === 'ArrowRight') nextSlide()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Navigation handlers
  const nextSlide = () => {
    setActiveIndex((prev) => (prev + 1) % total)
  }

  const prevSlide = () => {
    setActiveIndex((prev) => (prev - 1 + total) % total)
  }

  const goToSlide = (idx) => {
    setActiveIndex(idx)
  }

  // Autoplay with animated progress bar
  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReduced || isPaused || zoomItem) {
      if (progressTweenRef.current) progressTweenRef.current.pause()
      return
    }

    const fillEl = progressFillRef.current
    if (!fillEl) return

    gsap.set(fillEl, { width: '0%' })
    if (progressTweenRef.current) progressTweenRef.current.kill()

    progressTweenRef.current = gsap.to(fillEl, {
      width: '100%',
      duration: 4.8,
      ease: 'none',
      onComplete: () => {
        setActiveIndex((prev) => (prev + 1) % total)
      }
    })

    return () => {
      if (progressTweenRef.current) progressTweenRef.current.kill()
    }
  }, [activeIndex, isPaused, zoomItem, total])

  // Mobile Stacked Deck Draggable + Inertia
  useLayoutEffect(() => {
    if (isDesktop) return

    const cardEl = topCardRef.current
    if (!cardEl) return

    // Clean up previous instance
    if (draggableInstanceRef.current) {
      draggableInstanceRef.current.kill()
      draggableInstanceRef.current = null
    }

    // Reset position
    gsap.set(cardEl, { x: 0, y: 0, rotation: 0, opacity: 1, scale: 1 })

    const instances = Draggable.create(cardEl, {
      type: 'x,y',
      inertia: true,
      edgeResistance: 0.65,
      onPress: () => {
        setIsPaused(true)
      },
      onDrag: function () {
        gsap.set(this.target, { rotation: this.x * 0.055 })
      },
      onDragEnd: function () {
        setIsPaused(false)
        const throwThreshold = 75
        if (Math.abs(this.x) > throwThreshold || Math.abs(this.velocityX) > 280) {
          const dir = this.x > 0 ? 1 : -1
          gsap.to(this.target, {
            x: dir * 420,
            rotation: dir * 22,
            opacity: 0,
            duration: 0.32,
            ease: 'power2.in',
            onComplete: () => {
              setActiveIndex((prev) => (prev + 1) % total)
            }
          })
        } else {
          // Snap back
          gsap.to(this.target, {
            x: 0,
            y: 0,
            rotation: 0,
            duration: 0.4,
            ease: 'back.out(1.5)'
          })
        }
      }
    })

    draggableInstanceRef.current = instances[0]

    return () => {
      if (draggableInstanceRef.current) {
        draggableInstanceRef.current.kill()
        draggableInstanceRef.current = null
      }
    }
  }, [activeIndex, isDesktop, total])

  // Lightbox Modal with GSAP Flip
  const handleOpenZoom = (rev, e) => {
    const cardMedia = e.currentTarget.closest('.review-card-media') || e.currentTarget
    const state = Flip.getState(cardMedia)
    setZoomItem({ ...rev, flipState: state })
  }

  useLayoutEffect(() => {
    if (!zoomItem || !zoomItem.flipState) return
    const modalWrap = document.querySelector('.review-lightbox-img-wrap')
    if (modalWrap) {
      Flip.from(zoomItem.flipState, {
        targets: modalWrap,
        duration: 0.42,
        ease: 'power2.out',
        scale: true
      })
    }
  }, [zoomItem])

  // Desktop 3D Coverflow positioning
  const getCoverflowCardStyle = (index) => {
    let diff = index - activeIndex
    // Wrap around for seamless cycler
    if (diff > total / 2) diff -= total
    if (diff < -total / 2) diff += total

    if (diff === 0) {
      return {
        transform: 'translateX(0px) translateZ(0px) rotateY(0deg) scale(1)',
        zIndex: 20,
        opacity: 1,
        filter: 'brightness(1)',
        cursor: 'default',
        pointerEvents: 'auto'
      }
    }
    if (diff === -1) {
      return {
        transform: 'translateX(-220px) translateZ(-110px) rotateY(26deg) scale(0.86)',
        zIndex: 10,
        opacity: 0.8,
        filter: 'brightness(0.85)',
        cursor: 'pointer',
        pointerEvents: 'auto'
      }
    }
    if (diff === 1) {
      return {
        transform: 'translateX(220px) translateZ(-110px) rotateY(-26deg) scale(0.86)',
        zIndex: 10,
        opacity: 0.8,
        filter: 'brightness(0.85)',
        cursor: 'pointer',
        pointerEvents: 'auto'
      }
    }
    if (diff === -2) {
      return {
        transform: 'translateX(-390px) translateZ(-220px) rotateY(38deg) scale(0.72)',
        zIndex: 5,
        opacity: 0.45,
        filter: 'brightness(0.7)',
        cursor: 'pointer',
        pointerEvents: 'auto'
      }
    }
    if (diff === 2) {
      return {
        transform: 'translateX(390px) translateZ(-220px) rotateY(-38deg) scale(0.72)',
        zIndex: 5,
        opacity: 0.45,
        filter: 'brightness(0.7)',
        cursor: 'pointer',
        pointerEvents: 'auto'
      }
    }
    return {
      transform: diff < 0
        ? 'translateX(-520px) translateZ(-320px) rotateY(45deg) scale(0.6)'
        : 'translateX(520px) translateZ(-320px) rotateY(-45deg) scale(0.6)',
      zIndex: 1,
      opacity: 0,
      pointerEvents: 'none',
      filter: 'brightness(0.5)'
    }
  }

  // Mobile Stacked Deck positioning
  const getDeckCardStyle = (index) => {
    const rel = (index - activeIndex + total) % total

    if (rel === 0) {
      return {
        zIndex: 10,
        transform: 'translate3d(0, 0, 0) scale(1) rotate(0deg)',
        opacity: 1,
        pointerEvents: 'auto'
      }
    }
    if (rel === 1) {
      return {
        zIndex: 8,
        transform: 'translate3d(0, 14px, -30px) scale(0.95) rotate(-2.5deg)',
        opacity: 0.85,
        pointerEvents: 'none'
      }
    }
    if (rel === 2) {
      return {
        zIndex: 6,
        transform: 'translate3d(0, 26px, -60px) scale(0.90) rotate(2.5deg)',
        opacity: 0.65,
        pointerEvents: 'none'
      }
    }
    return {
      zIndex: 2,
      transform: 'translate3d(0, 36px, -90px) scale(0.85) rotate(0deg)',
      opacity: 0,
      pointerEvents: 'none'
    }
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

        {/* Carousel Stage Container */}
        <div
          className="reviews-carousel-wrap"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Autoplay Progress Line */}
          <div className="reviews-progress-track" title="অটোপ্লে প্রগ্রেস">
            <div className="reviews-progress-fill" ref={progressFillRef} />
          </div>

          {/* DESKTOP 3D COVERFLOW */}
          {isDesktop ? (
            <div className="reviews-coverflow-container">
              <button
                type="button"
                className="coverflow-nav-btn prev"
                onClick={prevSlide}
                aria-label="আগের রিভিউ"
              >
                <ChevronLeft size={22} />
              </button>

              {customerReviews.map((rev, idx) => {
                const style = getCoverflowCardStyle(idx)
                const isCenter = idx === activeIndex

                return (
                  <article
                    key={rev.id}
                    className={`reviews-coverflow-card ${isCenter ? 'active-center' : ''}`}
                    style={style}
                    onClick={() => {
                      if (!isCenter) goToSlide(idx)
                    }}
                  >
                    <div
                      className="review-card-media"
                      onClick={(e) => {
                        if (isCenter) handleOpenZoom(rev, e)
                      }}
                      role={isCenter ? 'button' : undefined}
                      tabIndex={isCenter ? 0 : -1}
                      aria-label={`${rev.customer} এর রিভিউ বড় করে দেখুন`}
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
                      {isCenter && (
                        <span className="review-zoom-btn">
                          <ZoomIn size={12} /> বড় করুন
                        </span>
                      )}
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
                )
              })}

              <button
                type="button"
                className="coverflow-nav-btn next"
                onClick={nextSlide}
                aria-label="পরের রিভিউ"
              >
                <ChevronRight size={22} />
              </button>
            </div>
          ) : (
            /* MOBILE STACKED DECK WITH DRAGGABLE + INERTIA */
            <div className="reviews-deck-container">
              {customerReviews.map((rev, idx) => {
                const rel = (idx - activeIndex + total) % total
                const isTop = rel === 0
                const style = getDeckCardStyle(idx)

                return (
                  <article
                    key={rev.id}
                    ref={isTop ? topCardRef : undefined}
                    className={`reviews-deck-card ${isTop ? 'is-top' : ''}`}
                    style={style}
                  >
                    <div
                      className="review-card-media"
                      onClick={(e) => {
                        if (isTop) handleOpenZoom(rev, e)
                      }}
                      role={isTop ? 'button' : undefined}
                      tabIndex={isTop ? 0 : -1}
                      aria-label={`${rev.customer} এর রিভিউ বড় করে দেখুন`}
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
                      {isTop && (
                        <span className="review-zoom-btn">
                          <ZoomIn size={12} /> বড় করুন
                        </span>
                      )}
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
                )
              })}
            </div>
          )}

          {/* Mobile Swipe Hint */}
          {!isDesktop && (
            <div className="deck-swipe-hint">
              <Hand size={14} color="#B8231C" />
              <span>কার্ড ডানে বা বামে সোয়াইপ করুন ({toBn(activeIndex + 1)}/{toBn(total)})</span>
            </div>
          )}

          {/* Dots Indicator & Quick Jumper */}
          <div className="reviews-dots-row" aria-label="রিভিউ নেভিগেশন">
            {customerReviews.map((_, idx) => (
              <button
                type="button"
                key={idx}
                className={`review-dot ${activeIndex === idx ? 'active' : ''}`}
                onClick={() => goToSlide(idx)}
                aria-label={`রিভিউ ${toBn(idx + 1)} তে যান`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Lightbox Modal with Flip */}
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
                style={{
                  padding: '6px',
                  borderRadius: '50%',
                  background: '#F5ECDD',
                  color: '#2A1A12',
                  border: 'none',
                  cursor: 'pointer'
                }}
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
