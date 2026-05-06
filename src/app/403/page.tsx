export default function Unauthorized() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <section className="rounded-2xl border border-line bg-surface p-8 text-center">
        <h1 className="text-4xl font-semibold">403</h1>
        <p className="mt-2 text-muted">Access denied. You do not have permission to view this resource.</p>
        <a
          href="/"
          className="mt-4 inline-block rounded-full bg-primary px-4 py-2 text-sm font-medium text-white"
        >
          Back to Home
        </a>
      </section>
    </main>
  );
}
