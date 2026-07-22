import TripDetailClient from "./TripDetailClient";

export async function generateStaticParams() {
  return [{ id: "default" }];
}

export default function TripDetailPage() {
  return <TripDetailClient />;
}
