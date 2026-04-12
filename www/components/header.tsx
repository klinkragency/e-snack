"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { UserCircle, ChevronRight, X, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const rafRef = useRef<number | null>(null);
  const user = useAppStore((s) => s.user);

  const updateScrollState = useCallback(() => {
    setIsScrolled(window.scrollY > 40);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateScrollState);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    updateScrollState();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [updateScrollState]);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isMenuOpen]);

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
          isScrolled
            ? "py-0 bg-background/90 backdrop-blur-xl border-b border-border/40 shadow-sm"
            : "py-0 bg-transparent"
        )}
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex h-16 items-center justify-between">

            {/* Logo */}
            <Link
              href="/"
              className={cn(
                "text-base font-bold tracking-widest uppercase transition-colors duration-300",
                isMenuOpen ? "text-black" : isScrolled ? "text-foreground" : "text-white"
              )}
            >
              BELDY&apos;S
            </Link>

            {/* Desktop center link */}
            <nav className="hidden md:flex">
              <Link
                href="/restaurants"
                className={cn(
                  "text-sm font-medium transition-colors duration-300 px-4 py-1.5 rounded-full",
                  isScrolled
                    ? "text-muted-foreground hover:text-foreground hover:bg-muted"
                    : "text-white/80 hover:text-white hover:bg-white/10"
                )}
              >
                Nos Restaurants
              </Link>
            </nav>

            {/* Desktop CTA */}
            <div className="hidden md:flex items-center gap-2">
              {user ? (
                <Link
                  href="/account"
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full transition-all duration-300",
                    isScrolled
                      ? "bg-foreground text-background hover:opacity-80"
                      : "bg-white text-foreground hover:bg-white/90"
                  )}
                >
                  <UserCircle size={15} />
                  Mon compte
                </Link>
              ) : (
                <>
                  <Link
                    href="/authentification"
                    className={cn(
                      "px-4 py-2 text-sm font-medium rounded-full transition-all duration-300",
                      isScrolled
                        ? "text-muted-foreground hover:text-foreground hover:bg-muted"
                        : "text-white/80 hover:text-white hover:bg-white/10"
                    )}
                  >
                    Connexion
                  </Link>
                  <Link
                    href="/restaurants"
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300",
                      isScrolled
                        ? "bg-foreground text-background hover:opacity-80"
                        : "bg-white text-foreground hover:bg-white/90"
                    )}
                  >
                    Commander
                    <ChevronRight size={14} strokeWidth={2.5} />
                  </Link>
                </>
              )}
            </div>

            {/* Mobile burger */}
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={cn(
                "md:hidden p-2 rounded-full transition-colors duration-300",
                isMenuOpen
                  ? "text-black hover:bg-muted"
                  : isScrolled ? "text-foreground hover:bg-muted" : "text-white hover:bg-white/10"
              )}
              aria-label="Menu"
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 md:hidden flex flex-col bg-background transition-all duration-300",
          isMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="flex h-16 items-center justify-between px-6 border-b border-border/40">
          <span className="text-base font-bold tracking-widest uppercase text-black">BELDY&apos;S</span>
          <button
            type="button"
            onClick={() => setIsMenuOpen(false)}
            className="p-2 rounded-full hover:bg-muted text-black"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex flex-col flex-1 px-6 pt-8 gap-1">
          <Link
            href="/restaurants"
            onClick={() => setIsMenuOpen(false)}
            className="flex items-center justify-between px-4 py-4 rounded-2xl hover:bg-muted transition-colors text-foreground font-medium"
          >
            Nos Restaurants
            <ChevronRight size={18} className="text-muted-foreground" />
          </Link>
        </nav>

        <div className="px-6 pb-10 flex flex-col gap-3">
          {user ? (
            <Link
              href="/account"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center justify-center gap-2 bg-foreground text-background rounded-full py-4 font-semibold"
            >
              <UserCircle size={17} />
              Mon compte
            </Link>
          ) : (
            <>
              <Link
                href="/authentification"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center justify-center rounded-full py-4 font-medium border border-border text-foreground hover:bg-muted transition-colors"
              >
                Connexion
              </Link>
              <Link
                href="/restaurants"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center justify-center gap-2 bg-foreground text-background rounded-full py-4 font-semibold"
              >
                Commander
                <ChevronRight size={15} strokeWidth={2.5} />
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}
