"use client";

const specs = [
  { label: "Restaurants", value: "4" },
  { label: "Livraison", value: "< 30min" },
  { label: "Zones", value: "Monaco+" },
  { label: "Satisfaction", value: "98%" },
];

export function EditorialSection() {
  return (
    <section className="bg-background">
      {/* Specs Grid */}
      <div className="grid grid-cols-2 border-t border-b border-border md:grid-cols-4">
        {specs.map((spec) => (
          <div
            key={spec.label}
            className="border-r border-border p-4 md:p-8 text-center last:border-r-0"
          >
            <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
              {spec.label}
            </p>
            <p className="font-medium text-foreground text-3xl md:text-4xl lg:text-5xl">
              {spec.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
