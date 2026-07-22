import GroupDetailClient from "./GroupDetailClient";

export async function generateStaticParams() {
  return [{ id: "default" }];
}

export default function GroupDetailsPage() {
  return <GroupDetailClient />;
}
