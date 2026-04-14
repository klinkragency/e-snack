const WORDS = [
  "Livraison",
  "Click & Collect",
  "Dine-in",
  "QR code",
  "Mollie",
  "Let's Encrypt",
  "WebSocket",
  "Multi-livreurs",
  "Telegram",
  "Allergènes",
  "Promos",
  "Formules",
  "OAuth",
  "OTP",
  "Analytics",
]

/** Horizontal scrolling strip of feature keywords — pure texture, no interaction. */
export function MarqueeStrip() {
  const content = (
    <div className="flex shrink-0 items-center gap-12 px-6">
      {WORDS.map((w, i) => (
        <span key={i} className="flex items-center gap-12">
          <span className="font-display text-4xl italic md:text-5xl">{w}</span>
          <span className="text-[var(--color-tomato)]">✦</span>
        </span>
      ))}
    </div>
  )
  return (
    <div className="relative overflow-hidden border-y border-[var(--color-line)] bg-[var(--color-ink)] py-6 text-[var(--color-paper)]">
      <div className="marquee flex w-max">
        {content}
        {content}
      </div>
    </div>
  )
}
