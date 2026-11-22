"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, ListChecks, Search, Server, Users, MessageCircle } from "lucide-react";
import SignOutButton from "./SignOutButton";

const discordInviteUrl = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL;

const navigation = [
  { heading: "REMOTE MANAGEMENT", items: [["servers", "Servers", Server], ["players", "Player lookup", Search], ["audit", "Audit Log", ListChecks]] },
  { heading: "STAFF TOOLS", items: [["registry", "Staff Registry", Users], ["loa", "Leaves of Absence", CalendarDays]] },
];

const paths = { servers: "/servers", players: "/players", audit: "/audit-log", registry: "/staff", loa: "/leaves" };

export default function Sidebar({ demo, user }) {
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
      {discordInviteUrl && <a className="discord-link" href={discordInviteUrl} target="_blank" rel="noopener noreferrer" title={collapsed ? "Join our Discord" : undefined}><MessageCircle size={16}/><span>Join our Discord</span><span className="external-mark">↗</span></a>}
      <div className="sidebar-footer" title={`${user?.name ?? "Staff member"} · Discord staff account`}><span className="account-avatar">{(user?.name ?? "S").slice(0, 1).toUpperCase()}</span><span className="account-copy"><strong>{user?.name ?? "Staff member"}</strong><small>{demo ? `${user?.discordRoleName ?? "Authorized role"} · Demo data` : user?.discordRoleName ?? "Authorized role"}</small></span><SignOutButton/></div>
    </div>
  </aside>;
}
