"use client";

export default function PortalError({ reset }) {
  return <section className="panel content-panel route-message" role="alert">
    <p className="eyebrow">WORKSPACE ERROR</p>
    <h1>This page couldn’t load</h1>
    <p className="muted">Try again. If the problem continues, check your connection or portal configuration.</p>
    <button className="button primary" onClick={() => reset()}>Try again</button>
  </section>;
}
