import RouteDetailClient from "./RouteDetailClient";

export async function generateStaticParams() {
  return [{ routeId: "default" }];
}

export default function SharedRoutePage() {
  return <RouteDetailClient />;
}
