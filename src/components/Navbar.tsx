"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Compass, Menu, X } from "lucide-react";
import { useSession, signOut } from "next-auth/react";

export default function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [guest, setGuest] = useState<{ remaining: number | null; limit: number } | null>(null);

  useEffect(() => {
    fetch("/api/guest-status")
      .then((r) => r.json())
      .then((d) => setGuest({ remaining: d.remaining, limit: d.limit }))
      .catch(() => {});
  }, [pathname]);

  const links = [
    { href: "/", label: "Home" },
    { href: "/plan", label: "Plan a trip" },
    { href: "/trips", label: "My trips" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-ink-900/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-display text-xl tracking-tight text-paper">
          <Compass className="h-5 w-5 text-brass" strokeWidth={1.75} />
          Voyager
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm transition-colors ${
                pathname === l.href ? "text-brass" : "text-paper/70 hover:text-paper"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-4 md:flex">
          {status !== "loading" && !session?.user && guest && guest.remaining !== null && (
            <span className="rounded-full border border-brass/30 bg-brass/10 px-3 py-1 text-xs text-brass">
              {guest.remaining}/{guest.limit} free plans left
            </span>
          )}
          {session?.user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-paper/70">Hi, {session.user.name?.split(" ")[0]}</span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="rounded-full border border-white/15 px-4 py-1.5 text-sm text-paper/80 transition hover:border-white/30 hover:text-paper"
              >
                Sign out
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/auth/signin"
                className="text-sm text-paper/80 transition hover:text-paper"
              >
                Sign in
              </Link>
              <Link
                href="/plan"
                className="rounded-full bg-coral px-4 py-1.5 text-sm font-medium text-ink-900 transition hover:bg-coral-light"
              >
                Start planning
              </Link>
            </>
          )}
        </div>

        <button className="md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-white/5 px-6 py-4 md:hidden">
          <div className="flex flex-col gap-4">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-paper/80" onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            ))}
            {session?.user ? (
              <button onClick={() => signOut({ callbackUrl: "/" })} className="text-left text-paper/80">
                Sign out
              </button>
            ) : (
              <Link href="/auth/signin" className="text-paper/80" onClick={() => setOpen(false)}>
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
