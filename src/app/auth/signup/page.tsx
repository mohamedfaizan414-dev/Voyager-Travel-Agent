import SignUpClient from "@/components/auth/SignUpClient";
export const dynamic = "force-dynamic";



export default function SignUpPage() {
  return (
    <main className="route-grid flex min-h-screen items-center justify-center px-6 py-20">
      <SignUpClient />
    </main>
  );
}
