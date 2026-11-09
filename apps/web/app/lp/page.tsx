import { redirect } from "next/navigation";

// /lp era a prévia da landing; agora a landing é a home. Redireciona.
export default function Page() {
  redirect("/");
}
