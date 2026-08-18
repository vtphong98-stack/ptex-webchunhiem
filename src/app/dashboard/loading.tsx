export default function Loading() {
  return (
    <main className="container py-4 md:py-6">
      <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="card h-fit p-4">
          <div style={{ height: 140, borderRadius: 24, background: "#0f172a", animation: "pulse 1.5s infinite" }} />
          <div className="mt-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ height: 44, borderRadius: 16, background: "#f1f5f9", animation: "pulse 1.5s infinite" }} />
            ))}
          </div>
        </aside>
        <section className="space-y-4">
          <div className="card p-6" style={{ height: 120, animation: "pulse 1.5s infinite" }} />
          <div className="grid-cards">
            {[1, 2, 3, 4].map((i) => (
              <div className="card p-5" key={i} style={{ height: 100, animation: "pulse 1.5s infinite" }} />
            ))}
          </div>
        </section>
      </div>
      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }`}</style>
    </main>
  );
}
