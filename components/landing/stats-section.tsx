"use client";

export function StatsSection() {
  const stats = [
    {
      number: "50K+",
      label: "Videos Created",
    },
    {
      number: "10M+",
      label: "Clips Generated",
    },
    {
      number: "98%",
      label: "User Satisfaction",
    },
    {
      number: "24/7",
      label: "Always Available",
    },
  ];

  return (
    <section className="py-12 sm:py-16 md:py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="text-center space-y-2 animate-fade-in p-3 sm:p-4"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-primary text-balance">
                {stat.number}
              </div>
              <div className="text-xs sm:text-sm md:text-base text-muted-foreground font-medium">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
