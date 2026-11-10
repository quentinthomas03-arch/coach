import { Component, type ReactNode } from 'react'

/** Affiche l'erreur au lieu d'un écran blanc, avec un bouton pour recharger. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="p-5 pt-[max(env(safe-area-inset-top),24px)]">
        <h1 className="display text-2xl mb-3">Oups, un problème</h1>
        <p className="mb-3">Tes données sont intactes. Recharge l'appli ; si ça se reproduit, envoie-moi ce message :</p>
        <pre className="card text-xs whitespace-pre-wrap break-words">
          {this.state.error.name}: {this.state.error.message}
        </pre>
        <button className="btn-primary w-full mt-4" onClick={() => location.reload()}>
          Recharger
        </button>
      </div>
    )
  }
}
