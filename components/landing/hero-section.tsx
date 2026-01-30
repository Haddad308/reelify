"use client";

import Link from "next/link";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  const locale = useLocale();

  return (
    <section className="relative min-h-[calc(100vh-80px)] flex items-center justify-center overflow-hidden pt-16 pb-16 px-4 sm:pt-20 sm:pb-20">
      {/* Animated background elements */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="max-w-4xl mx-auto text-center space-y-6 sm:space-y-8 animate-fade-in">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20 hover:border-primary/40 transition-colors">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          <span className="text-sm font-medium text-primary">
            Create professional reels in minutes
          </span>
        </div>

        {/* Main headline */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-balance leading-tight">
            Transform videos into
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary mt-2 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              viral reels
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto text-balance leading-relaxed px-2">
            AI-powered video editing with automatic transcription and smart captions. Create engaging content for any platform in seconds.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-2 sm:pt-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <Link href={`/${locale}/editor`}>
            <Button
              size="lg"
              className="h-12 sm:h-14 px-6 sm:px-8 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:scale-105 active:scale-95 w-full sm:w-auto"
            >
              Start Creating
            </Button>
          </Link>
          <Button
            variant="outline"
            size="lg"
            className="h-12 sm:h-14 px-6 sm:px-8 text-base font-semibold border-2 hover:bg-muted transition-all duration-300 w-full sm:w-auto"
          >
            See How It Works
          </Button>
        </div>

        {/* Social proof */}
        <div className="pt-6 sm:pt-8 text-sm text-muted-foreground animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <p>Trusted by creators worldwide</p>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mt-3 sm:mt-4 opacity-60">
            {['Instagram', 'TikTok', 'YouTube'].map((platform) => (
              <span key={platform} className="font-medium text-xs sm:text-sm">{platform}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
