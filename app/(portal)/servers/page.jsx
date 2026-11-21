import Portal from "../../Portal";

export default async function ServersPage({ searchParams }) {
  const params = await searchParams;
  const experience = typeof params.experience === "string" ? params.experience : undefined;
  const server = typeof params.server === "string" ? params.server : undefined;
  return <Portal tab="servers" initialGame={experience} initialServer={server}/>;
}
