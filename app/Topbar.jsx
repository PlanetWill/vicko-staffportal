"use client";
import { usePathname } from "next/navigation";

const breadcrumbs = [
  { match: pathname => pathname === "/servers", section: "Operations", page: "Servers" },
  { match: pathname => pathname.startsWith("/servers/"), section: "Operations", page: "Server details" },
  { match: pathname => pathname.startsWith("/servers/"), section: "Operations", page: "Server details" },
  { match: pathname => pathname === "/players", section: "Operations", page: "Player lookup" },
  { match: pathname => pathname.startsWith("/players/"), section: "Operations", page: "Player profile" },
  { match: pathname => pathname === "/audit-log", section: "Operations", page: "Audit Log" },
  { match: pathname => pathname === "/staff", section: "People", page: "Staff Registry" },
  { match: pathname => pathname === "/leaves", section: "People", page: "Leaves of Absence" },
];

export default function Topbar({ demo }) {
  const pathname = usePathname();
  const breadcrumb = breadcrumbs.find(item => item.match(pathname)) ?? breadcrumbs[0];
  return <header className="topbar"><div className="topbar-inner">
    <span>{breadcrumb.section}</span><span className="divider">›</span><strong>{breadcrumb.page}</strong>
    <span className="topbar-status"><span className={demo ? "dot demo" : "dot"}/>{demo ? "Demo environment" : "Connected"}</span>
  </div></header>;
}
