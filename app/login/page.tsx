import { redirect } from "next/navigation";
import { currentDevice } from "@/lib/session";
import { listCredentials, maxDevices } from "@/lib/webauthn";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentDevice()) redirect("/");
  const count = (await listCredentials()).length;
  return <LoginForm deviceCount={count} maxDevices={maxDevices()} />;
}
