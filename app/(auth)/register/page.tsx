import { redirect } from "next/navigation";

// No auth - redirect to home
export default function Page() {
  redirect("/");
}
