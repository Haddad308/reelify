"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";

export function CTASection() {
  const locale = useLocale();

  return (
    <section className="py-12 sm:py-16 md:py-20 px-4 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-secondary/5" />
        <div className="absolute top-1/2 right-0 w-64 h-64 sm:w-96 sm:h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/2" />
      </div>

      <div className="max-w-3xl mx-auto text-center space-y-6 sm:space-y-8 animate-fade-in px-4">
        <div className="space-y-3 sm:space-y-4">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-balance">
            Ready to create amazing content?
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Join thousands of creators transforming their videos into viral moments.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-2 sm:pt-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <Link href={`/${locale}/editor`}>
            <Button
              size="lg"
              className="h-12 sm:h-14 px-6 sm:px-8 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:scale-105 active:scale-95 w-full sm:w-auto"
            >
              Start Free Now
            </Button>
          </Link>
        </div>

        <p className="text-xs sm:text-sm text-muted-foreground">
          No credit card required. Start creating immediately.
        </p>
      </div>
    </section>
  );
}
