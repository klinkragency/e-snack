import { Reveal } from "./reveal"

type Step = {
  n: string
  title: string
  sub: string
  body: string
  tech: string[]
  timing: string
}

const STEPS: Step[] = [
  {
    n: "01",
    title: "Le client valide",
    sub: "Panier → commande",
    body:
      "Le client clique « Payer ». Le BFF Next.js valide via Zod, appelle le service Order en gRPC côté Go. Une transaction PostgreSQL atomique crée la commande, les items, les options, l'historique de statut, le lien vers le code promo — tout ou rien.",
    tech: ["Zod", "grpc-gateway", "pg transaction", "schema validation"],
    timing: "~40ms p99",
  },
  {
    n: "02",
    title: "Mollie prend le paiement",
    sub: "Checkout → webhook",
    body:
      "Le service Payment crée un PaymentIntent chez Mollie, reçoit l'URL de checkout, redirige le client. Côté retour : webhook idempotent, pattern outbox, la commande passe en paid sans jamais doublons, même si Mollie rejoue 10 fois.",
    tech: ["Mollie API", "outbox pattern", "idempotency key", "webhook signature"],
    timing: "~200ms",
  },
  {
    n: "03",
    title: "La cuisine reçoit",
    sub: "WebSocket push",
    body:
      "Un canal Redis pub/sub broadcast la commande aux cuisines connectées. L'écran kitchen affiche en live (WebSocket → Redis ↔ Redis → WebSocket), pas de polling, pas de latence. Le cuisinier met la commande en préparation d'un clic.",
    tech: ["gorilla/websocket", "Redis pub/sub", "AUTH_REQUIRED protocol", "STATUS_CHANGE event"],
    timing: "< 100ms",
  },
  {
    n: "04",
    title: "Dispatch livreurs",
    sub: "Selection & broadcast",
    body:
      "Quand la commande passe en ready, le service Delivery interroge les livreurs actifs dans la zone de livraison. Chacun reçoit une notification Telegram avec bouton Accept/Reject inline keyboard. Premier qui accepte gagne, les autres voient « commande prise ».",
    tech: ["Haversine distance", "Telegram inline_keyboard", "race-condition-safe assignation", "assignment_cancelled status"],
    timing: "< 2s pour la première réponse",
  },
  {
    n: "05",
    title: "Tracking GPS live",
    sub: "5s d'intervalle",
    body:
      "Le livreur assigné diffuse sa position toutes les 5 secondes via l'app mobile. Le service Delivery la stocke et la pousse au client via WebSocket. Le client voit son livreur se rapprocher sur la carte, timeline vivante, notifications quand il est à < 500m.",
    tech: ["LocationUpdate event", "driver_locations table", "PostGIS optional", "proximity trigger"],
    timing: "5000ms polling",
  },
  {
    n: "06",
    title: "Livraison finalisée",
    sub: "Paiement capturé",
    body:
      "Le livreur swipe « Livré ». Le backend marque la commande delivered, capture le paiement Mollie (si pré-autorisation), envoie un email de reçu au client, ferme le WebSocket, demande une note de livraison. L'historique est conservé pour audit.",
    tech: ["Mollie capture", "Resend confirmation", "review_requests", "status_history audit log"],
    timing: "instant",
  },
]

export function Anatomy() {
  return (
    <section
      id="anatomie"
      className="relative mx-auto max-w-7xl px-6 py-32 md:px-12 md:py-48"
    >
      <Reveal as="p" className="bistro-divider mb-16">
        <span>Anatomie d&apos;une commande — chapitre 06</span>
      </Reveal>

      <div className="grid gap-16 md:grid-cols-[1fr_1.5fr] md:items-start">
        <Reveal as="h2" className="font-display text-5xl leading-[0.95] md:text-7xl">
          Le voyage<br />
          d&apos;une<br />
          <em className="text-[var(--color-tomato)]">livraison.</em>
        </Reveal>

        <Reveal as="p" delay={1} className="text-lg leading-relaxed text-[var(--color-ink-soft)]">
          De la validation du panier jusqu&apos;à la sonnette. Six étapes,
          six systèmes, chacun avec ses contraintes et ses garanties.
          Pas de magie — juste des composants éprouvés qui se parlent
          proprement.
        </Reveal>
      </div>

      <ol className="mt-24 space-y-16 md:space-y-20">
        {STEPS.map((step, i) => (
          <Reveal
            key={step.n}
            as="li"
            delay={((i % 3) + 1) as 1 | 2 | 3}
            className="group relative grid gap-8 border-t border-[var(--color-line)] pt-10 md:grid-cols-[auto_1fr_1fr] md:gap-12"
          >
            <div className="flex items-start gap-4 md:flex-col md:gap-8">
              <span className="font-display text-6xl italic leading-none text-[var(--color-tomato)] md:text-7xl">
                {step.n}
              </span>
              <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-ink-soft)] md:mt-0">
                {step.timing}
              </span>
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-soft)]">
                {step.sub}
              </p>
              <h3 className="mt-2 font-display text-3xl leading-tight md:text-4xl">
                {step.title}
              </h3>
              <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-ink-soft)]">
                {step.body}
              </p>
            </div>

            <div className="flex flex-wrap content-start gap-2">
              {step.tech.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-[var(--color-ink)]/15 bg-white px-3 py-1.5 font-mono text-[11px] text-[var(--color-ink)]"
                >
                  {t}
                </span>
              ))}
            </div>
          </Reveal>
        ))}
      </ol>
    </section>
  )
}
