import { requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { ROLES, ROLE_LABELS, type AppUser } from "@/lib/roles";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { NotAllowed } from "../../not-allowed";
import { AddUserForm } from "./add-user-form";
import { changeRole, setActive } from "./actions";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const session = await requireSession();
  if (session.user.role !== "partner") return <NotAllowed who="a partner" />;

  const supabase = await createClient();
  const { data: users, error } = await supabase
    .from("users")
    .select("id, firm_id, name, email, mobile, role, active, created_at")
    .eq("is_deleted", false)
    .order("active", { ascending: false })
    .order("name")
    .returns<AppUser[]>();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Users</h1>

      <Card>
        <CardHeader>
          <CardTitle>Add a user</CardTitle>
          <CardDescription>
            There is no public sign-up. Only a partner creates logins here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AddUserForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>
            Deactivating a user blocks their login. Their history stays in the records.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {error && <p className="text-sm text-destructive">Could not load users: {error.message}</p>}
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium">Mobile</th>
                <th className="py-2 pr-4 font-medium">Role</th>
                <th className="py-2 pr-4 font-medium">Added on</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(users ?? []).map((u) => {
                const isSelf = u.id === session.user.id;
                return (
                  <tr key={u.id} className={u.active ? "" : "text-muted-foreground"}>
                    <td className="py-2 pr-4">
                      {u.name}
                      {isSelf && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                    </td>
                    <td className="py-2 pr-4">{u.email}</td>
                    <td className="py-2 pr-4">{u.mobile}</td>
                    <td className="py-2 pr-4">
                      {isSelf ? (
                        ROLE_LABELS[u.role]
                      ) : (
                        <form action={changeRole} className="flex gap-2">
                          <input type="hidden" name="id" value={u.id} />
                          <Select name="role" defaultValue={u.role} className="h-8 w-28">
                            {ROLES.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </option>
                            ))}
                          </Select>
                          <Button size="sm" variant="outline" type="submit">
                            Save
                          </Button>
                        </form>
                      )}
                    </td>
                    <td className="py-2 pr-4">{formatDate(u.created_at)}</td>
                    <td className="py-2">
                      {isSelf ? (
                        "Active"
                      ) : (
                        <form action={setActive} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={u.id} />
                          <input type="hidden" name="active" value={String(!u.active)} />
                          <span>{u.active ? "Active" : "Inactive"}</span>
                          <Button size="sm" variant={u.active ? "outline" : "default"} type="submit">
                            {u.active ? "Deactivate" : "Reactivate"}
                          </Button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
