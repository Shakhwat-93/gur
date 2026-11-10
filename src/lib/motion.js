import { animate, createTimeline, createScope, createDrawable, stagger } from 'animejs'

export const prefersReducedMotion = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Beat Sequence for Above-the-Fold Hero:
 * Setup -> Primary Move (headline + arch visual) -> Secondary Support (staggered chips & CTAs)
 * -> Botanical SVG line draw -> Rest & Settle.
 */
export function mountHeroChoreography(rootEl) {
  if (!rootEl || prefersReducedMotion()) return () => {}

  const scope = createScope({ root: rootEl }).add(() => {
    const tl = createTimeline({
      defaults: { ease: 'outQuart' }
    })

    tl.add('.hero-pill', {
      opacity: [0, 1],
      translateY: [10, 0],
      duration: 340,
    })
      .add(
        '.hero-stagger',
        {
          opacity: [0, 1],
          translateY: [14, 0],
          duration: 420,
          delay: stagger(45),
        },
        '-=200'
      )
      .add(
        '.hero-arch-card',
        {
          opacity: [0, 1],
          scale: [0.96, 1],
          translateY: [16, 0],
          duration: 500,
          ease: 'outCubic',
        },
        '-=360'
      )
      .add(
        '.hero-float-card',
        {
          opacity: [0, 1],
          translateY: [12, 0],
          duration: 380,
          delay: stagger(60),
        },
        '-=260'
      )

    const drawPaths = createDrawable('.hero-botanical-path')
    if (drawPaths && drawPaths.length) {
      animate(drawPaths, {
        draw: ['0 0', '0 1'],
        duration: 1050,
        delay: stagger(140),
        ease: 'inOutCubic',
      })
    }
  })

  return () => scope.revert()
}

/**
 * Scroll-triggered stagger choreography for below-the-fold grid cards & timeline steps.
 * StrictMode-safe with Anime.js v4 createScope cleanup.
 */
export function observeStaggerGroup(containerEl, selector = '.stagger-card') {
  if (!containerEl) return () => {}
  const items = containerEl.querySelectorAll(selector)
  if (!items.length) return () => {}

  if (prefersReducedMotion()) {
    items.forEach((el) => {
      el.style.opacity = '1'
      el.style.transform = 'none'
    })
    return () => {}
  }

  let played = false
  let scope = null

  const run = () => {
    if (played) return
    played = true
    scope = createScope({ root: containerEl }).add(() => {
      animate(selector, {
        opacity: [0, 1],
        translateY: [18, 0],
        duration: 420,
        delay: stagger(38, { start: 30 }),
        ease: 'outCubic',
      })
    })
  }

  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect()
        run()
      }
    },
    { threshold: 0.06, rootMargin: '0px 0px 80px 0px' }
  )

  io.observe(containerEl)
  return () => {
    io.disconnect()
    if (scope) scope.revert()
  }
}

/**
 * SVG path drawing on scroll for artisanal journey linework.
 */
export function observeSvgDraw(svgEl) {
  if (!svgEl || prefersReducedMotion()) return () => {}
  const targetPaths = svgEl.querySelectorAll('.draw-step-line')
  if (!targetPaths.length) return () => {}

  let drawn = false
  let scope = null

  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting) && !drawn) {
        drawn = true
        io.disconnect()
        scope = createScope({ root: svgEl }).add(() => {
          const paths = createDrawable('.draw-step-line')
          animate(paths, {
            draw: ['0 0', '0 1'],
            duration: 950,
            delay: stagger(100),
            ease: 'inOutQuart',
          })
        })
      }
    },
    { threshold: 0.12 }
  )

  io.observe(svgEl)
  return () => {
    io.disconnect()
    if (scope) scope.revert()
  }
}

/**
 * Tactile spring pulse confirmation when a user updates quantity or selects combo.
 */
export function pulseElement(el) {
  if (!el || prefersReducedMotion()) return
  animate(el, {
    scale: [1, 1.06, 1],
    duration: 220,
    ease: 'outBack(1.8)',
  })
}
