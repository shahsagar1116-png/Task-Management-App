"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { ROLES, ROLE_LABELS } from "@/lib/roles";
import { addUser, type ActionState } from "./actions";

export function AddUserForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(addUser, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.message) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-4 sm:grid-cols-2">
      {state.error && <Alert tone="error" className="sm:col-span-2">{state.error}</Alert>}
      {state.message && <Alert tone="success" className="sm:col-span-2">{state.message}</Alert>}
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="mobile">Mobile (optional)</Label>
        <Input id="mobile" name="mobile" inputMode="tel" placeholder="98xxxxxxxx" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="role">Role</Label>
        <Select id="role" name="role" defaultValue="staff">
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Temporary password</Label>
        <Input id="password" name="password" type="text" minLength={8} autoComplete="off" required />
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add user"}
        </Button>
      </div>
    </form>
  );
}
