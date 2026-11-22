import Portal from "../../Portal";

export const metadata = { title: "Audit Log", description: "Review staff actions and their outcomes." };

export default async function AuditLogPage({ searchParams }) {
  const params = await searchParams;
  return <Portal tab="audit" initialQuery={typeof params.serverId === "string" ? params.serverId : ""}/>;
}
