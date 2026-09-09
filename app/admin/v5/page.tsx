import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/server-foundation";
import PlatformClient from "./platform-client";

export default async function V5ControlPage() {
  const incoming = await headers();
  const host = incoming.get("host") ?? "localhost";
  const protocol = incoming.get("x-forwarded-proto") ?? "https";
  const viewer = await getViewer(new Request(`${protocol}://${host}/admin/v5`, { headers: incoming }));
  if (!viewer || viewer.role !== "ADMIN") redirect("/");
  return <PlatformClient />;
}
