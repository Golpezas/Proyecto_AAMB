import { FanActions } from "@/components/fan-actions";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Join @{handle}</h1>
          <p className="mt-2 text-muted-foreground">
            Subscribe to get live alerts and pings — no phone number required.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <FanActions handle={handle} />
        </div>
      </div>
    </main>
  );
}