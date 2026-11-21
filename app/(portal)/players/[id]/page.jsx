import Portal from "../../../Portal";

export default async function PlayerProfilePage({ params }) {
  const { id } = await params;
  return <Portal tab="players" playerId={id}/>;
}
