import Sidebar from "../Sidebar";
import Topbar from "../Topbar";
import { demo } from "../api";

export default function PortalLayout({ children }) {
  return <div className={`shell${demo ? " demo-shell" : ""}`}>
    <Sidebar demo={demo}/>
    <div className="workspace">
      <Topbar demo={demo}/>
      <main className="workspace-main mx-auto">{children}</main>
    </div>
  </div>;
}
