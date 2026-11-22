import Portal from "../../../Portal";

export const metadata = { title: "Player profile", description: "Review player presence and moderation history." };

export default async function PlayerProfilePage({ params }) {
  const { id } = await params;
  return <Portal tab="players" playerId={id}/>;
}
