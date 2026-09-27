import { Component, type ReactNode } from 'react'

/** Shows a reload prompt instead of a blank page if a page crashes or fails to load. */
export default class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error(error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="min-h-screen flex items-center justify-center px-4 pt-16">
        <div className="max-w-sm w-full text-center space-y-4">
          <h1 className="font-display font-extrabold text-2xl text-galaksi-100">This page didn't load</h1>
          <p className="text-sm text-stone-300">The site was probably just updated. Reloading fixes it.</p>
          <button onClick={() => window.location.reload()} className="btn-galaksi w-full min-h-[52px]">
            Reload
          </button>
        </div>
      </div>
    )
  }
}
