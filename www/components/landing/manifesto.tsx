import { Reveal } from "./reveal"

export function Manifesto() {
  return (
    <section
      id="manifeste"
      className="relative mx-auto max-w-7xl px-6 py-32 md:px-12 md:py-48"
    >
      <Reveal as="p" className="bistro-divider mb-16">
        <span>Manifeste — chapitre 01</span>
      </Reveal>

      <div className="grid gap-16 md:grid-cols-[1fr_1.4fr]">
        <Reveal as="h2" className="font-display text-5xl leading-[0.92] md:text-7xl">
          Un restaurateur<br />
          qui installe<br />
          <em className="text-[var(--color-tomato)]">e-snack</em>,<br />
          c&apos;est un<br />
          restaurateur<br />
          qui récupère<br />
          ses commissions.
        </Reveal>

        <div className="space-y-8 text-lg leading-relaxed text-[var(--color-ink-soft)] md:text-[19px]">
          <Reveal as="p" delay={1}>
            Les plateformes existantes prélèvent <strong className="font-semibold text-[var(--color-ink)]">25 à 35 %</strong> sur chaque commande. Pour un restaurateur qui vend 100&nbsp;€, ça représente 30&nbsp;€ qui partent. Sur l&apos;année, c&apos;est un salarié.
          </Reveal>
          <Reveal as="p" delay={2}>
            e-snack inverse l&apos;équation. Vous hébergez votre propre plateforme, sur votre domaine, avec votre image. Vos clients commandent directement chez vous. Les paiements vont directement sur votre compte Mollie. Zéro intermédiaire qui prend sa part.
          </Reveal>
          <Reveal as="p" delay={3}>
            Le projet est pensé pour le <strong className="font-semibold text-[var(--color-ink)]">cas réel d&apos;un snack</strong> — pas pour un pitch startup. Commande à table par QR code, click & collect avec créneaux, livraison avec dispatch multi-livreurs, tout marche le premier jour.
          </Reveal>
          <Reveal as="p" delay={4}>
            <em className="font-display text-[var(--color-ink)]">Votre métier c&apos;est la cuisine. Le nôtre, c&apos;est la logistique.</em>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
