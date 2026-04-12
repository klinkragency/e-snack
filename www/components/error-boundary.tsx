"use client"

import { Component, type ReactNode } from "react"
import { RotateCcw } from "lucide-react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6">
          <div className="text-center space-y-2">
            <h2 className="text-lg font-bold">Une erreur est survenue</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Quelque chose s&apos;est mal passé. Essayez de recharger la page.
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <RotateCcw size={14} />
            Réessayer
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
