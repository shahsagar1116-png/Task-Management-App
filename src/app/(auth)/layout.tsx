export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-sm font-medium text-muted-foreground">
          Sagar B Shah &amp; Associates
        </p>
        {children}
      </div>
    </main>
  );
}
