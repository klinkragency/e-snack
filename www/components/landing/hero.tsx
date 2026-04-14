"use client"

import { useEffect, useRef } from "react"

export function Hero() {
  const parallaxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = parallaxRef.current
    if (!el) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const y = window.scrollY
        el.style.transform = `translate3d(0, ${y * 0.18}px, 0)`
      })
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  const title = "Ouvrez."
  const title2 = "Cuisinez."
  const title3 = "Vendez."

  return (
    <section
      id="top"
      className="relative flex min-h-[100svh] items-center overflow-hidden px-6 pt-32 pb-16 md:px-12"
    >
      {/* Parallax decoration — typographic ornament */}
      <div
        ref={parallaxRef}
        aria-hidden
        className="pointer-events-none absolute -right-32 top-10 select-none font-display text-[40vw] italic leading-none text-[var(--color-ink)]/[0.035] md:-right-10 md:text-[28vw]"
      >
        é
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl">
        <p className="mb-10 flex items-center gap-3 text-xs font-medium uppercase tracking-[0.22em] text-[var(--color-ink-soft)]">
          <span className="h-px w-8 bg-[var(--color-ink-soft)]" />
          Plateforme de commande · clé-en-main
        </p>

        <h1 className="font-display text-[13vw] leading-[0.88] tracking-tight md:text-[9.5vw]">
          <span className="block">
            {[...title].map((c, i) => (
              <span key={i} className="char" style={{ animationDelay: `${i * 55}ms` }}>
                {c}
              </span>
            ))}
          </span>
          <span className="block italic text-[var(--color-tomato)]">
            {[...title2].map((c, i) => (
              <span key={i} className="char" style={{ animationDelay: `${(i + title.length) * 55 + 100}ms` }}>
                {c}
              </span>
            ))}
          </span>
          <span className="block">
            {[...title3].map((c, i) => (
              <span key={i} className="char" style={{ animationDelay: `${(i + title.length + title2.length) * 55 + 200}ms` }}>
                {c}
              </span>
            ))}
          </span>
        </h1>

        <div className="mt-14 grid gap-10 md:grid-cols-[1.4fr_1fr] md:items-end">
          <p className="max-w-xl text-lg leading-relaxed text-[var(--color-ink-soft)] md:text-xl">
            Une plateforme complète qui transforme votre restaurant en commerce en ligne.
            Livraison, click & collect, commande à table via QR code. Tout le stack est là —
            <em className="font-display text-[var(--color-ink)]"> votre métier c&apos;est la cuisine</em>,
            le nôtre c&apos;est le reste.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="#contact"
              className="group inline-flex items-center gap-3 rounded-full bg-[var(--color-ink)] px-7 py-4 text-sm font-semibold text-[var(--color-paper)] transition-all hover:bg-[var(--color-tomato)]"
            >
              Demander une démo
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </a>
            <a
              href="#manifeste"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-ink)]/20 px-6 py-4 text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]/50 hover:bg-[var(--color-ink)]/[0.04]"
            >
              Découvrir le projet
            </a>
          </div>
        </div>

        {/* Three modes badges */}
        <div className="mt-16 flex flex-wrap items-center gap-x-10 gap-y-4 border-t border-[var(--color-line)] pt-10 text-sm">
          {[
            { n: "01", label: "Livraison" },
            { n: "02", label: "Click & Collect" },
            { n: "03", label: "Sur place · QR" },
          ].map((m) => (
            <div key={m.n} className="flex items-baseline gap-3">
              <span className="font-mono text-xs text-[var(--color-tomato)]">{m.n}</span>
              <span className="font-display text-2xl italic">{m.label}</span>
            </div>
          ))}
        </div>

        {/* Scroll cue */}
        <div className="mt-16 flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-[var(--color-ink-soft)]">
          <span className="inline-block h-7 w-px animate-pulse bg-[var(--color-ink-soft)]" />
          Faites défiler
        </div>
      </div>
    </section>
  )
}
