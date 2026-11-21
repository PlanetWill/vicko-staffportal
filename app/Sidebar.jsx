"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, ListChecks, Search, Server, Users, MessageCircle } from "lucide-react";

const navigation = [
  { heading: "REMOTE MANAGEMENT", items: [["servers", "Servers", Server], ["players", "Player lookup", Search], ["audit", "Audit Log", ListChecks]] },
  { heading: "STAFF TOOLS", items: [["registry", "Staff Registry", Users], ["loa", "Leaves of Absence", CalendarDays]] },
];

const paths = { servers: "/servers", players: "/players", audit: "/audit-log", registry: "/staff", loa: "/leaves" };

export default function Sidebar({ demo }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  return <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
    <div className="sidebar-top">
      <div className="brand"><img className="brand-logo" src="/brand/vicko-logo.png" alt="Vicko"/><div className="brand-copy">Vicko<small>Staff workspace</small></div></div>
      <button className="collapse-button" onClick={() => setCollapsed(value => !value)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
        {collapsed ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}
      </button>
    </div>
    <nav aria-label="Staff tools">
      {navigation.map(group => <section className="nav-group" key={group.heading}>
        <p>{group.heading}</p>
        {group.items.map(([id, label, Icon]) => {
          const active = pathname === paths[id] || (id === "players" && pathname.startsWith("/players/"));
          return <Link key={id} href={paths[id]} aria-current={active ? "page" : undefined} title={collapsed ? label : undefined} className={active ? "nav-item selected" : "nav-item"}><Icon size={16}/><span>{label}</span></Link>;
        })}
      </section>)}
    </nav>
    <div className="sidebar-bottom">
      <a className="discord-link" href="https://discord.com" target="_blank" rel="noreferrer" title={collapsed ? "Join our Discord" : undefined}><MessageCircle size={16}/><span>Join our Discord</span><span className="external-mark">↗</span></a>
      <div className="sidebar-footer" title={demo ? "Demo staff · Preview account" : "Staff workspace · API configured"}><span className="account-avatar">V</span><span className="account-copy"><strong>{demo ? "Demo staff" : "Staff workspace"}</strong><small>{demo ? "Preview account" : "API configured"}</small></span></div>
    </div>
  </aside>;
}
