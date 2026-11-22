import Portal from "../../../Portal";
import { demo, getDemoOverview } from "../../../api";

export const metadata = { title: "Server details", description: "Review live health and recent activity for a server." };

export default async function ServerDetailsPage({ params }) {
  const { id } = await params;
  return <Portal tab="server-detail" serverId={id} initialData={demo ? getDemoOverview() : undefined}/>;
}
