"use client"

import { createElement, useEffect, useRef, useState, type ReactNode } from "react"

type Tag = "div" | "section" | "li" | "ul" | "ol" | "p" | "span" | "h1" | "h2" | "h3" | "h4" | "article" | "header" | "footer" | "main"

type Props = {
  children: ReactNode
  delay?: 1 | 2 | 3 | 4 | 5 | 6
  as?: Tag
  className?: string
}

/** Fades + slides content into view when it first enters the viewport. */
export function Reveal({ children, delay, as = "div", className = "" }: Props) {
  const ref = useRef<HTMLElement | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || inView) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold: 0.15 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [inView])

  const delayClass = delay ? ` reveal-delay-${delay}` : ""
  return createElement(
    as,
    {
      ref,
      className: `reveal${delayClass}${inView ? " in" : ""} ${className}`,
    },
    children
  )
}
