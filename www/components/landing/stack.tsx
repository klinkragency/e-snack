import { Reveal } from "./reveal"

const STACK = [
  { k: "Go 1.25", v: "API gRPC-first + REST gateway, compilé en binaire natif." },
  { k: "Next.js 16", v: "App Router, React 19, BFF pour l'admin, Server Components." },
  { k: "PostgreSQL 16", v: "Source unique de vérité, migrations versionnées." },
  { k: "Redis 7", v: "Pub/sub pour les WebSockets, cache sessions, throttling." },
  { k: "Caddy 2", v: "Reverse-proxy, TLS Let's Encrypt auto, HTTP/2 + HTTP/3." },
  { k: "Docker Compose", v: "Déploiement atomique en 1 commande, rollback git reset." },
  { k: "MinIO", v: "S3-compatible self-host pour les uploads d'images." },
  { k: "Mollie", v: "Paiements UE, webhooks idempotents, outbox pattern." },
  { k: "Resend", v: "Magic links, OTP, confirmations, factures PDF." },
]

export function Stack() {
  return (
    <section
      id="stack"
      className="relative mx-auto max-w-7xl px-6 py-32 md:px-12 md:py-48"
    >
      <Reveal as="p" className="bistro-divider mb-16">
        <span>Sous le capot — chapitre 07</span>
      </Reveal>

      <div className="grid gap-16 md:grid-cols-[1fr_1.5fr] md:items-start">
        <Reveal as="h2" className="font-display text-5xl leading-[0.95] md:text-6xl">
          Des outils<br />
          qui se<br />
          <em className="text-[var(--color-tomato)]">respectent.</em>
        </Reveal>

        <div>
          <Reveal as="p" delay={1} className="mb-10 text-lg leading-relaxed text-[var(--color-ink-soft)]">
            e-snack ne réinvente rien — on assemble des briques éprouvées,
            avec une obsession : pas de magie, pas de lock-in, pas de dépendance
            fantôme. Quand vous ouvrez le repo, vous lisez et vous comprenez.
          </Reveal>

          <Reveal delay={2} className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-ink)] text-[var(--color-paper)]">
            <div className="flex items-center gap-1.5 border-b border-[var(--color-paper)]/10 px-4 py-3">
              <span className="h-2 w-2 rounded-full bg-[var(--color-paper)]/20" />
              <span className="h-2 w-2 rounded-full bg-[var(--color-paper)]/20" />
              <span className="h-2 w-2 rounded-full bg-[var(--color-paper)]/20" />
              <span className="ml-4 font-mono text-[10px] text-[var(--color-paper)]/50">
                $ cat docker-compose.yml
              </span>
            </div>
            <ul className="divide-y divide-[var(--color-paper)]/5 font-mono text-[13px]">
              {STACK.map((s) => (
                <li key={s.k} className="grid grid-cols-[auto_1fr] gap-4 px-5 py-3">
                  <span className="w-32 shrink-0 text-[var(--color-tomato)]">{s.k}</span>
                  <span className="text-[var(--color-paper)]/70">{s.v}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
