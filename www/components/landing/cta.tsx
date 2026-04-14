import { Reveal } from "./reveal"

export function CTA() {
  return (
    <section
      id="contact"
      className="relative overflow-hidden bg-[var(--color-ink)] text-[var(--color-paper)]"
    >
      <div className="mx-auto max-w-7xl px-6 py-40 md:px-12 md:py-56">
        <Reveal as="p" className="bistro-divider mb-16 text-[var(--color-paper)]/70">
          <span>On en parle ?</span>
        </Reveal>

        <Reveal as="h2" className="font-display text-[12vw] leading-[0.88] md:text-[8vw]">
          Votre<br />
          restaurant<br />
          mérite sa<br />
          <em className="text-[var(--color-tomato)]">plateforme.</em>
        </Reveal>

        <div className="mt-16 grid gap-10 md:grid-cols-[1fr_auto] md:items-end">
          <Reveal as="p" delay={1} className="max-w-xl text-lg leading-relaxed text-[var(--color-paper)]/70 md:text-xl">
            Une démo en 5 minutes, sur un sous-domaine à vous.
            Vous cassez tout, vous testez, vous décidez.
          </Reveal>

          <Reveal delay={2}>
            <a
              href="mailto:contact@klinkragency.fr?subject=Démo%20e-snack"
              className="group inline-flex items-center gap-4 rounded-full bg-[var(--color-tomato)] px-8 py-5 text-lg font-semibold text-[var(--color-paper)] transition-all hover:bg-[var(--color-paper)] hover:text-[var(--color-ink)]"
            >
              Demander une démo
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </a>
          </Reveal>
        </div>
      </div>

      <footer className="border-t border-[var(--color-paper)]/10">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-6 py-8 text-sm text-[var(--color-paper)]/50 md:flex-row md:items-center md:px-12">
          <p className="font-display text-lg italic text-[var(--color-paper)]">
            e-snack<span className="text-[var(--color-tomato)]">.</span>
          </p>
          <p className="font-mono text-xs">
            © 2026 Klinkragency · Plateforme open-source · Built for restaurateurs
          </p>
        </div>
      </footer>
    </section>
  )
}
