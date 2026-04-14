import { Reveal } from "./reveal"

const FEATURES = [
  { t: "Magic link + OTP", d: "Authentification sans mot de passe via Resend." },
  { t: "OAuth Google", d: "Sign-in fédéré pour les clients récurrents." },
  { t: "Allergènes", d: "Étiquetés par produit, affichés sur la carte." },
  { t: "Infos nutritionnelles", d: "Calories, protéines, glucides — optionnel." },
  { t: "Horaires configurables", d: "Jour par jour, fermeture exceptionnelle." },
  { t: "Zones de livraison", d: "Rayon en km, frais par zone, seuil gratuit." },
  { t: "Promo codes", d: "Pourcentage, montant fixe, usage limité, dates." },
  { t: "Formules / combos", d: "Menu avec groupes de choix, options incluses." },
  { t: "Multi-livreurs dispatch", d: "Assignation auto ou manuelle, SLA de réponse." },
  { t: "Telegram livreurs", d: "Notif par chauffeur, accept/reject depuis Telegram." },
  { t: "Import IA du menu", d: "Colle une carte papier, GPT structure les produits." },
  { t: "Analytics PostHog", d: "Funnel commande, top produits, rétention clients." },
  { t: "Dashboard admin", d: "CRUD menu, commandes, drivers, clients, réglages." },
  { t: "Image uploads", d: "MinIO self-hosted, CDN via Caddy, cache long-lived." },
  { t: "Factures PDF", d: "Génération serveur, historique par commande." },
  { t: "Migrations auto", d: "golang-migrate au boot, zéro downtime." },
  { t: "TLS auto Let's Encrypt", d: "Caddy certifie au premier hit, HTTP/2, HSTS." },
  { t: "Multi-restaurant ready", d: "Mono par défaut, flag pour plusieurs enseignes." },
]

export function FeatureGrid() {
  return (
    <section
      id="details"
      className="relative mx-auto max-w-7xl px-6 py-32 md:px-12 md:py-48"
    >
      <Reveal as="p" className="bistro-divider mb-16">
        <span>Chaque détail compte — chapitre 06</span>
      </Reveal>

      <div className="grid gap-16 md:grid-cols-[1fr_2fr] md:items-start">
        <Reveal as="h2" className="font-display text-5xl leading-[0.95] md:text-6xl">
          Le diable<br />
          est dans le<br />
          <em className="text-[var(--color-tomato)]">détail.</em>
        </Reveal>

        <Reveal as="p" delay={1} className="text-lg leading-relaxed text-[var(--color-ink-soft)]">
          e-snack n&apos;est pas un MVP. C&apos;est 18 mois de terrain, 20+ micro-features
          que le restaurateur n&apos;apprécie que le jour où il en a besoin.
        </Reveal>
      </div>

      <div className="mt-20 grid gap-px bg-[var(--color-line)] sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {FEATURES.map((f, i) => (
          <Reveal
            key={f.t}
            delay={((i % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6}
            className="group bg-[var(--color-paper)] p-6 transition-colors hover:bg-[var(--color-ink)] hover:text-[var(--color-paper)]"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-tomato)]">
              {String(i + 1).padStart(2, "0")}
            </p>
            <h3 className="mt-3 font-display text-xl leading-tight md:text-[22px]">{f.t}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-soft)] group-hover:text-[var(--color-paper)]/70">
              {f.d}
            </p>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
