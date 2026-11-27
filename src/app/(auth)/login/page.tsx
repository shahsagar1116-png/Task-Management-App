import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

const NOTICES: Record<string, { tone: "info" | "success" | "error"; text: string }> = {
  expired: { tone: "info", text: "Your session ended after 12 hours. Please sign in again." },
  inactive: {
    tone: "error",
    text: "Your login is not active in this app. Ask the partner to add or reactivate you.",
  },
  reset: { tone: "success", text: "Password changed. Sign in with your new password." },
  signedout: { tone: "info", text: "You have signed out." },
  linkerror: { tone: "error", text: "That link has expired or was already used. Request a new one." },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const key = Object.keys(NOTICES).find((k) => params[k]);
  const notice = key ? NOTICES[key] : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Compliance task tracker</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
        <LoginForm />
      </CardContent>
    </Card>
  );
}
