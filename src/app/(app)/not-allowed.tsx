import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function NotAllowed({ who }: { who: string }) {
  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Not allowed</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p>Only {who} can open this page.</p>
        <Link href="/dashboard" className="text-primary hover:underline">
          Back to dashboard
        </Link>
      </CardContent>
    </Card>
  );
}
