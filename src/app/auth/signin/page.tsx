export const dynamic = "force-dynamic";


import SignInClient from "@/components/auth/SignInClient";

export default function SignInPage() {
  return (
    <main className="route-grid flex min-h-screen items-center justify-center px-6 py-20">
      <SignInClient />
    </main>
  );
}
