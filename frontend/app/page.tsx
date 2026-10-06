import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight">
          Go live. <span className="text-primary">Everyone knows.</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Privacy-first notifications for creators. Fans subscribe with a
          wallet — no phone numbers, no emails, ever.
        </p>
        <Button size="lg" className="mt-8">Get Started Free</Button>
      </section>
      <section className="mx-auto max-w-4xl px-6 pb-24 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Wallet identity</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Fans subscribe by signing with an embedded wallet.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Instant push</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Pings and live alerts arrive as web push — fast and free.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Verifiable events</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Live events are mirrored to an on-chain notary, asynchronously.
          </CardContent>
        </Card>
      </section>
    </main>
  );
}