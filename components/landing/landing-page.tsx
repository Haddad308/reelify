"use client";

import { HeroSection } from "@/components/landing/hero-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { StatsSection } from "@/components/landing/stats-section";
import { CTASection } from "@/components/landing/cta-section";
import { useLocale } from "next-intl";
import Link from "next/link";

export function LandingPage() {
  const locale = useLocale();

  return (
    <main className="min-h-screen bg-background">
      {/* Header/Navbar */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="text-xl sm:text-2xl font-bold text-primary">Reelify</div>
          <nav className="hidden md:flex items-center gap-6 sm:gap-8 text-sm font-medium">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#stats" className="text-muted-foreground hover:text-foreground transition-colors">Impact</a>
            <Link href={`/${locale}/editor`} className="text-muted-foreground hover:text-foreground transition-colors">Editor</Link>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <HeroSection />
      
      <div id="features">
        <FeaturesSection />
      </div>
      
      <div id="stats">
        <StatsSection />
      </div>
      
      <CTASection />

      {/* Footer */}
      <footer className="border-t border-border/50 py-6 sm:py-8 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto text-center text-xs sm:text-sm text-muted-foreground">
          <p className="mb-3 sm:mb-4">© 2024 Reelify. All rights reserved.</p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 justify-center">
            <Link href={`/${locale}/privacy`} className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link href={`/${locale}/terms`} className="hover:text-primary transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
