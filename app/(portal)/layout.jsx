import { redirect } from "next/navigation";
import { auth, isDiscordAuthConfigured } from "../../auth";
import Sidebar from "../Sidebar";
import Topbar from "../Topbar";
import { demo } from "../api";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }) {
  if (!isDiscordAuthConfigured()) redirect("/login?error=Configuration");
  const session = await auth();
  if (!session?.user?.staffAuthorized || !session.user.discordId) redirect("/login?error=SessionExpired");

  return <div className={`shell${demo ? " demo-shell" : ""}`}>
    <Sidebar demo={demo} user={session.user}/>
    <div className="workspace">
      <Topbar demo={demo}/>
      <main className="workspace-main mx-auto">{children}</main>
    </div>
  </div>;
}
