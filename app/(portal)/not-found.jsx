import Link from "next/link";

export default function PortalNotFound() {
  return <section className="panel content-panel route-message">
    <p className="eyebrow">404 · PAGE NOT FOUND</p>
    <h1>This page isn’t available</h1>
    <p className="muted">The page may have moved, or the address may be incorrect.</p>
    <Link className="button primary" href="/servers">Return to servers</Link>
  </section>;
}
