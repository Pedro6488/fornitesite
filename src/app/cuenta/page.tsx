import { AccountAccess } from "@/features/auth/components/account-access";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ next?: string; mode?: string }> }) {
  const params = await searchParams;
  const requestedNext = params.next;
  const nextPath = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/cuenta";
  const initialMode = params.mode === "register" ? "register" : "login";
  return <section className="account-page"><AccountAccess nextPath={nextPath} initialMode={initialMode} /></section>;
}
