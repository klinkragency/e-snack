"use client"

import { useEffect, useState } from "react"
import { Reveal } from "./reveal"

export function Tracking() {
  return (
    <section
      id="suivi"
      className="relative overflow-hidden bg-[var(--color-ink)] text-[var(--color-paper)]"
    >
      <div className="mx-auto max-w-7xl px-6 py-32 md:px-12 md:py-48">
        <Reveal as="p" className="bistro-divider mb-16 text-[var(--color-paper)]/70">
          <span>Suivi en temps réel — chapitre 05</span>
        </Reveal>

        <div className="grid gap-16 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <Reveal as="h2" className="font-display text-5xl leading-[0.95] md:text-7xl">
              Chaque<br />
              commande<br />
              <em className="text-[var(--color-tomato)]">respire.</em>
            </Reveal>

            <Reveal as="p" delay={1} className="mt-8 text-lg leading-relaxed text-[var(--color-paper)]/75">
              Dès la commande passée, le client voit un timeline live : payé → en préparation → prête → en route → livrée. Sur mode livraison, la position du livreur est diffusée en WebSocket toutes les 5 secondes.
            </Reveal>

            <Reveal as="ul" delay={2} className="mt-10 grid gap-3 text-[15px] text-[var(--color-paper)]/75 sm:grid-cols-2">
              {[
                "WebSocket bidirectionnel",
                "Redis pub/sub multi-instance",
                "Temps de préparation ajustable",
                "Historique des statuts auditable",
                "Notifs Telegram aux livreurs",
                "Rappels email aux clients",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-2 inline-block h-1 w-3 bg-[var(--color-tomato)]" />
                  {item}
                </li>
              ))}
            </Reveal>
          </div>

          <Reveal delay={2}>
            <MiniMap />
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function MiniMap() {
  const [driverIdx, setDriverIdx] = useState(0)
  const path = [
    { x: 18, y: 72 },
    { x: 28, y: 58 },
    { x: 38, y: 50 },
    { x: 48, y: 45 },
    { x: 58, y: 38 },
    { x: 68, y: 32 },
    { x: 76, y: 24 },
  ]

  useEffect(() => {
    const t = setInterval(() => {
      setDriverIdx((i) => (i + 1) % path.length)
    }, 1200)
    return () => clearInterval(t)
  }, [path.length])

  const driver = path[driverIdx]

  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-[var(--color-paper)]/15 bg-[var(--color-paper)]/[0.04]">
      {/* grid texture */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <pattern id="g" width="28" height="28" patternUnits="userSpaceOnUse">
            <path
              d="M 28 0 L 0 0 0 28"
              fill="none"
              stroke="rgba(250,246,238,0.08)"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#g)" />
      </svg>

      {/* route line */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        <polyline
          points={path.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="var(--color-tomato)"
          strokeWidth="0.5"
          strokeDasharray="2 1.5"
          opacity="0.5"
        />
      </svg>

      {/* Restaurant dot (start) */}
      <Pin
        x={path[0].x}
        y={path[0].y}
        label="restaurant"
        color="var(--color-paper)"
      />

      {/* Customer dot (end) */}
      <Pin
        x={path[path.length - 1].x}
        y={path[path.length - 1].y}
        label="client"
        color="var(--color-paper)"
      />

      {/* Driver dot (moves) */}
      <div
        className="absolute pulse-dot text-[var(--color-tomato)]"
        style={{
          left: `${driver.x}%`,
          top: `${driver.y}%`,
          transition: "left 1s ease-in-out, top 1s ease-in-out",
          transform: "translate(-50%, -50%)",
          width: 14,
          height: 14,
        }}
      >
        <div className="absolute inset-0 rounded-full bg-current" />
      </div>

      {/* Timeline overlay card */}
      <div className="absolute inset-x-4 bottom-4 rounded-xl border border-[var(--color-paper)]/15 bg-[var(--color-ink)]/80 p-4 backdrop-blur-md">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-paper)]/50">
          Commande #F51BCCFC
        </p>
        <ul className="mt-3 space-y-1.5 text-[13px]">
          <TimelineRow label="Payée" done />
          <TimelineRow label="En préparation" done />
          <TimelineRow label="En route" done active />
          <TimelineRow label="Livrée" />
        </ul>
      </div>
    </div>
  )
}

function Pin({
  x,
  y,
  label,
  color,
}: {
  x: number
  y: number
  label: string
  color: string
}) {
  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <span
        className="h-3 w-3 rounded-full border-2 border-[var(--color-ink)]"
        style={{ backgroundColor: color }}
      />
      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--color-paper)]/60">
        {label}
      </span>
    </div>
  )
}

function TimelineRow({
  label,
  done,
  active,
}: {
  label: string
  done?: boolean
  active?: boolean
}) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          active
            ? "bg-[var(--color-tomato)] shadow-[0_0_0_3px_rgba(204,58,30,0.25)]"
            : done
              ? "bg-[var(--color-paper)]"
              : "bg-[var(--color-paper)]/20"
        }`}
      />
      <span className={done || active ? "text-[var(--color-paper)]" : "text-[var(--color-paper)]/40"}>
        {label}
      </span>
    </li>
  )
}
