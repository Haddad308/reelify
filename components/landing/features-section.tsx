"use client";

export function FeaturesSection() {
  const features = [
    {
      icon: "🎬",
      title: "Auto Transcription",
      description: "Automatic speech-to-text in multiple languages. Instantly convert your video dialogue into accurate transcripts."
    },
    {
      icon: "✨",
      title: "Smart Captions",
      description: "AI-generated captions that match your content perfectly. Boost engagement with automatically styled subtitles."
    },
    {
      icon: "⚡",
      title: "Lightning Fast",
      description: "Process videos in seconds with our optimized editor. No waiting around, create at the speed of creativity."
    },
    {
      icon: "🎯",
      title: "Platform Optimized",
      description: "Auto-format for Instagram, TikTok, YouTube, and more. Export ready-to-post content for any platform."
    },
    {
      icon: "🔄",
      title: "Smart Clipping",
      description: "Intelligent scene detection finds the best moments. AI helps you create viral-worthy clips effortlessly."
    },
    {
      icon: "🎨",
      title: "Customizable",
      description: "Full control over captions, colors, and effects. Make it uniquely yours with powerful editing tools."
    },
  ];

  return (
    <section className="py-12 sm:py-16 md:py-20 px-4 bg-gradient-to-b from-transparent to-primary/5">
      <div className="max-w-6xl mx-auto">
        <div className="text-center space-y-3 sm:space-y-4 mb-12 sm:mb-16 animate-fade-in">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-balance">
            Everything you need to create
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto px-2">
            Powerful features designed to make video editing effortless and fast
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-border hover:border-primary/30 shadow-card hover:shadow-lg transition-all duration-300 hover:translate-y-[-4px] animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="text-3xl sm:text-4xl mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-300">
                {feature.icon}
              </div>
              <h3 className="text-lg sm:text-xl font-bold mb-2 text-foreground">
                {feature.title}
              </h3>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
