import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";

export const runtime = "nodejs";

export default async function Root() {
  const user = await getUser();
  redirect(user ? "/home" : "/sign-in");
}
