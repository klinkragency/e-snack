import { Reveal } from "./reveal"

const MODES = [
  {
    n: "01",
    title: "Livraison",
    tagline: "À domicile, en temps réel.",
    body:
      "Dispatch automatique vers plusieurs livreurs, tracking GPS diffusé en WebSocket au client, notifications Telegram pour les chauffeurs, zones et frais de livraison configurables, seuil de livraison gratuite, temps de préparation ajustable en cuisine.",
    stat: "100%",
    statLabel: "commissions",
  },
  {
    n: "02",
    title: "Click & Collect",
    tagline: "Le client passe, vous servez.",
    body:
      "Créneaux horaires programmables, rappels email 15 minutes avant, statut en direct (en préparation → prête), paiement en ligne ou sur place, impression ticket automatique, zéro confusion en caisse.",
    stat: "0 €",
    statLabel: "de frais de livraison",
  },
  {
    n: "03",
    title: "Sur place · QR",
    tagline: "Scanne, commande, paye.",
    body:
      "Un QR code par table. Le client scanne, parcourt le menu, commande sans attendre un serveur, paye en ligne ou demande l'addition. Le staff reçoit un ping, apporte le plat. Plus rapide, moins d'erreurs.",
    stat: "3×",
    statLabel: "rotation des tables",
  },
]

export function ThreeModes() {
  return (
    <section
      id="modes"
      className="relative bg-[var(--color-ink)] text-[var(--color-paper)]"
    >
      <div className="mx-auto max-w-7xl px-6 py-32 md:px-12 md:py-48">
        <Reveal as="p" className="bistro-divider mb-16 text-[var(--color-paper)]/70">
          <span>Trois façons de vendre — chapitre 02</span>
        </Reveal>

        <Reveal as="h2" className="max-w-4xl font-display text-5xl leading-[0.95] md:text-7xl">
          Un menu, <em>trois canaux</em>, aucun compromis.
        </Reveal>

        <Reveal as="p" delay={2} className="mt-8 max-w-2xl text-lg text-[var(--color-paper)]/70">
          e-snack n&apos;est pas spécialisé dans la livraison. Ni dans le click&nbsp;&amp;&nbsp;collect.
          Ni dans le dine-in. Les trois, depuis le même menu, avec la même stack.
        </Reveal>

        <div className="mt-20 grid gap-px bg-[var(--color-paper)]/10 md:grid-cols-3">
          {MODES.map((m, i) => (
            <Reveal
              key={m.n}
              delay={(i + 1) as 1 | 2 | 3}
              className="group flex flex-col gap-6 bg-[var(--color-ink)] p-8 transition-colors hover:bg-[var(--color-ink)]/80 md:p-10"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-xs text-[var(--color-tomato)]">{m.n}</span>
                <span className="font-display text-4xl italic leading-none text-[var(--color-paper)]/90 md:text-5xl">
                  {m.stat}
                </span>
              </div>
              <div>
                <h3 className="font-display text-3xl leading-tight md:text-4xl">{m.title}</h3>
                <p className="mt-1 text-sm italic text-[var(--color-paper)]/60">{m.tagline}</p>
              </div>
              <p className="text-[15px] leading-relaxed text-[var(--color-paper)]/75">{m.body}</p>
              <p className="mt-auto text-[10px] uppercase tracking-[0.2em] text-[var(--color-paper)]/40">
                {m.statLabel}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
