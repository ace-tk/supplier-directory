import { redirect } from "next/navigation";
import { getUser } from "@/lib/session";
import { AddFreelancerForm } from "@/components/admin/freelancers/add-freelancer-form";

export default async function NewFreelancerPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/freelancers/new");
  if (user.role !== "ADMIN") redirect("/freelancers");

  return <AddFreelancerForm />;
}
