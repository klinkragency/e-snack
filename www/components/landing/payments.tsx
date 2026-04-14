import { Reveal } from "./reveal"

export function Payments() {
  return (
    <section
      id="paiements"
      className="relative mx-auto max-w-7xl px-6 py-32 md:px-12 md:py-48"
    >
      <Reveal as="p" className="bistro-divider mb-16">
        <span>Paiements — chapitre 04</span>
      </Reveal>

      <div className="grid gap-16 md:grid-cols-[1.4fr_1fr] md:items-end">
        <Reveal as="h2" className="font-display text-5xl leading-[0.95] md:text-7xl">
          L&apos;argent arrive.<br />
          <em className="text-[var(--color-tomato)]">Sur votre compte.</em><br />
          Sans intermédiaire.
        </Reveal>

        <Reveal as="p" delay={1} className="text-lg leading-relaxed text-[var(--color-ink-soft)]">
          Le paiement en ligne passe par <strong className="text-[var(--color-ink)]">Mollie</strong> — vous connectez votre compte marchand, les fonds tombent directement. e-snack ne touche jamais à l&apos;argent. On vous fournit l&apos;infrastructure, vous gardez la trésorerie.
        </Reveal>
      </div>

      <div className="mt-20 grid gap-px bg-[var(--color-line)] md:grid-cols-2">
        <Reveal delay={1} className="bg-[var(--color-paper)] p-8 md:p-12">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-tomato)]">
            Online · Mollie
          </p>
          <h3 className="mt-4 font-display text-3xl leading-tight md:text-4xl">
            Carte, Bancontact, Apple Pay, SEPA.
          </h3>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
            Webhooks idempotents, pattern outbox pour le suivi des paiements, confirmations de commande atomiques. Les remboursements se déclenchent depuis l&apos;admin en un clic, l&apos;historique des évènements est conservé pour audit.
          </p>
          <div className="mt-8 grid grid-cols-4 gap-2">
            {["CB", "BC", "PAY", "SEPA"].map((t) => (
              <div
                key={t}
                className="rounded-lg border border-[var(--color-ink)]/10 bg-white px-2 py-3 text-center font-mono text-[10px] uppercase tracking-wider text-[var(--color-ink-soft)]"
              >
                {t}
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={2} className="bg-[var(--color-paper)] p-8 md:p-12">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-olive)]">
            Sur place
          </p>
          <h3 className="mt-4 font-display text-3xl leading-tight md:text-4xl">
            Le client paye à la caisse.
          </h3>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
            Pour le click&nbsp;&amp;&nbsp;collect ou le dine-in, option paiement au comptoir. La commande est marquée <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">on_site</code>, sans passer par Mollie. Pratique pour un snack du coin qui n&apos;a pas envie de configurer un compte marchand le premier jour.
          </p>
          <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-[var(--color-ink)]/5 px-4 py-2 text-xs text-[var(--color-ink-soft)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-olive)]" />
            Fallback automatique si <code className="font-mono">MOLLIE_API_KEY</code> est vide
          </div>
        </Reveal>
      </div>
    </section>
  )
}
