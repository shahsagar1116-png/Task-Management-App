import { requireSession } from "@/lib/session";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Dashboard" };

// What each role may do (spec Section 2). Shown so testers can check the rules.
const PERMISSIONS: { action: string; allowed: Record<Role, string> }[] = [
  { action: "Add or remove users", allowed: { partner: "Yes", manager: "No", staff: "No" } },
  { action: "Add, edit, import clients", allowed: { partner: "Yes", manager: "Yes", staff: "No" } },
  { action: "Edit compliance mapping and due dates", allowed: { partner: "Yes", manager: "Yes", staff: "No" } },
  { action: "See tasks", allowed: { partner: "All", manager: "All", staff: "Own tasks only" } },
  { action: "Mark task Filed / Completed", allowed: { partner: "Yes", manager: "Yes", staff: "No" } },
  { action: "Delete clients or tasks", allowed: { partner: "Yes (soft delete)", manager: "No", staff: "No" } },
];

export default async function DashboardPage() {
  const { user } = await requireSession();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
        <p className="text-sm text-muted-foreground">
          You are signed in as {ROLE_LABELS[user.role].toLowerCase()}. Clients, tasks and the
          dashboard counts arrive in the next phases.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>What you can do</CardTitle>
          <CardDescription>These rules are enforced by the database, not only on screen.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {PERMISSIONS.map((p) => (
              <li key={p.action} className="flex justify-between gap-4 py-2">
                <span>{p.action}</span>
                <span className="font-medium">{p.allowed[user.role]}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
