import RequestWorkspace from "@/components/request-workspace";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home({ searchParams }: { searchParams: Promise<{ welcome?: string | string[] }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const query = await searchParams;
  return <RequestWorkspace email={user.email} welcome={query.welcome === "created"} />;
}
