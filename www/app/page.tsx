import { LandingNav } from "@/components/landing/nav"
import { Hero } from "@/components/landing/hero"
import { MarqueeStrip } from "@/components/landing/marquee-strip"
import { Manifesto } from "@/components/landing/manifesto"
import { ThreeModes } from "@/components/landing/three-modes"
import { MenuDemo } from "@/components/landing/menu-demo"
import { Payments } from "@/components/landing/payments"
import { Tracking } from "@/components/landing/tracking"
import { FeatureGrid } from "@/components/landing/feature-grid"
import { Stack } from "@/components/landing/stack"
import { CTA } from "@/components/landing/cta"

export default function Home() {
  return (
    <div className="landing-root grain relative">
      <LandingNav />
      <main>
        <Hero />
        <MarqueeStrip />
        <Manifesto />
        <ThreeModes />
        <MenuDemo />
        <Payments />
        <Tracking />
        <FeatureGrid />
        <Stack />
        <CTA />
      </main>
    </div>
  )
}
