import { Reveal } from "./reveal"

/**
 * Closing section — replaces the old CTA. This landing page is itself
 * a live demo of the platform it describes, so there's no "request a
 * demo" button. Instead we close on a statement + a pointer to the
 * actual menu (which is the real product behind this landing).
 */
export function Colophon() {
  return (
    <section className="relative overflow-hidden bg-[var(--color-ink)] text-[var(--color-paper)]">
      <div className="mx-auto max-w-7xl px-6 py-40 md:px-12 md:py-56">
        <Reveal as="p" className="bistro-divider mb-16 text-[var(--color-paper)]/70">
          <span>Colophon</span>
        </Reveal>

        <Reveal as="h2" className="font-display text-[12vw] leading-[0.88] md:text-[8vw]">
          Cette page<br />
          que vous<br />
          lisez tourne<br />
          <em className="text-[var(--color-tomato)]">sur e-snack.</em>
        </Reveal>

        <div className="mt-16 grid gap-10 md:grid-cols-[1fr_auto] md:items-end">
          <Reveal as="p" delay={1} className="max-w-2xl text-lg leading-relaxed text-[var(--color-paper)]/70 md:text-xl">
            Tout ce qui est décrit ici — commandes, livraison, paiements,
            tracking, admin — fonctionne derrière le même domaine.
            Le menu est à <code className="font-mono text-base text-[var(--color-paper)]">/restaurants</code>.
          </Reveal>

          <Reveal delay={2}>
            <a
              href="/restaurants"
              className="group inline-flex items-center gap-4 rounded-full bg-[var(--color-tomato)] px-8 py-5 text-lg font-semibold text-[var(--color-paper)] transition-all hover:bg-[var(--color-paper)] hover:text-[var(--color-ink)]"
            >
              Voir le menu
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </a>
          </Reveal>
        </div>

        {/* Technical specs stripe */}
        <Reveal delay={3} className="mt-24 grid gap-y-6 gap-x-12 border-t border-[var(--color-paper)]/10 pt-10 font-mono text-xs text-[var(--color-paper)]/60 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <p className="uppercase tracking-[0.25em] text-[var(--color-paper)]/40">
              Backend
            </p>
            <p className="mt-2 text-[var(--color-paper)]">Go 1.25 · gRPC + REST gateway</p>
          </div>
          <div>
            <p className="uppercase tracking-[0.25em] text-[var(--color-paper)]/40">
              Frontend
            </p>
            <p className="mt-2 text-[var(--color-paper)]">Next.js 16 · React 19 · Tailwind v4</p>
          </div>
          <div>
            <p className="uppercase tracking-[0.25em] text-[var(--color-paper)]/40">
              Données
            </p>
            <p className="mt-2 text-[var(--color-paper)]">PostgreSQL 16 · Redis 7 · MinIO</p>
          </div>
          <div>
            <p className="uppercase tracking-[0.25em] text-[var(--color-paper)]/40">
              Infra
            </p>
            <p className="mt-2 text-[var(--color-paper)]">Caddy 2 · Docker Compose · Let&apos;s Encrypt</p>
          </div>
        </Reveal>
      </div>

      <footer className="border-t border-[var(--color-paper)]/10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-6 py-8 text-sm text-[var(--color-paper)]/50 md:flex-row md:items-center md:px-12">
          <p className="font-display text-lg italic text-[var(--color-paper)]">
            e-snack<span className="text-[var(--color-tomato)]">.</span>
          </p>
          <p className="font-mono text-xs">
            © 2026 · Built for restaurateurs, not for platforms.
          </p>
        </div>
      </footer>
    </section>
  )
}
