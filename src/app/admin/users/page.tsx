import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import AdminUsersPage from "./users-client";

export const dynamic = "force-dynamic";

export default async function AdminUsersRoute() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");
  return <AdminUsersPage />;
}
