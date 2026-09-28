import { redirect } from "next/navigation";
import { currentDevice } from "@/lib/session";
import { listCredentials } from "@/lib/webauthn";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  if (await currentDevice()) redirect("/");
  const { invite } = await searchParams;
  const count = (await listCredentials()).length;
  return <LoginForm deviceCount={count} invite={typeof invite === "string" ? invite : ""} />;
}
