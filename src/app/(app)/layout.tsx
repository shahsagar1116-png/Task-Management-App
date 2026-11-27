import Link from "next/link";
import { requireSession } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/roles";
import { Button } from "@/components/ui/button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, firmName } = await requireSession();

  const links = [
    { href: "/dashboard", label: "Dashboard", show: true },
    // Hidden for others, and the page and database also refuse them.
    { href: "/settings/users", label: "Users", show: user.role === "partner" },
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/dashboard" className="font-semibold">
            {firmName || "Task Management"}
          </Link>
          <nav className="flex gap-4 text-sm">
            {links
              .filter((l) => l.show)
              .map((l) => (
                <Link key={l.href} href={l.href} className="text-muted-foreground hover:text-foreground">
                  {l.label}
                </Link>
              ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span>
              {user.name}{" "}
              <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {ROLE_LABELS[user.role]}
              </span>
            </span>
            <form action="/auth/signout" method="post">
              <Button variant="outline" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
