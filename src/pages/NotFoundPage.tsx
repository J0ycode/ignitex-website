import { Link } from 'react-router-dom'

/** Unknown address — often a page added in a newer deploy than the one this tab loaded. */
export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-16">
      <div className="max-w-sm w-full text-center space-y-4">
        <p className="font-mono text-sm text-galaksi-400">404</p>
        <h1 className="font-display font-extrabold text-2xl text-galaksi-100">Page not found</h1>
        <p className="text-sm text-stone-300">
          If this is a new page, your browser may have an older copy of the site. Reloading fixes it.
        </p>
        <button onClick={() => window.location.reload()} className="btn-galaksi w-full min-h-[52px]">Reload</button>
        <Link to="/" className="block text-sm text-stone-400 hover:text-galaksi-100 min-h-[44px] leading-[44px]">Go to home page</Link>
      </div>
    </div>
  )
}
