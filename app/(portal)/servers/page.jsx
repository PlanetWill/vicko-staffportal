import Portal from "../../Portal";
import { demo, getDemoOverview } from "../../api";

export const metadata = { title: "Servers", description: "Monitor active Roblox experiences and servers." };

export default async function ServersPage({ searchParams }) {
  const params = await searchParams;
  const experience = typeof params.experience === "string" ? params.experience : undefined;
  const server = typeof params.server === "string" ? params.server : undefined;
  return <Portal tab="servers" initialGame={experience} initialServer={server} initialData={demo ? getDemoOverview() : undefined}/>;
}
