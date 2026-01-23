"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function PreviewContent() {
  const searchParams = useSearchParams();
  const url = searchParams.get("url");
  const title = searchParams.get("title") || "مقطع فيديو";
  const duration = searchParams.get("duration");
  const thumbnail = searchParams.get("thumbnail");

  if (!url) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-red-500">رابط الفيديو غير موجود</p>
            <Button className="mt-4" onClick={() => window.close()}>
              إغلاق
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleDownload = async () => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${title}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch {
      // Fallback: open in new tab
      window.open(url, "_blank");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-3xl shadow-xl border-0 bg-white">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl text-gray-900">{title}</CardTitle>
          {duration && (
            <p className="text-muted-foreground text-sm">{duration} ثانية</p>
          )}
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div className="aspect-video bg-gray-900 rounded-xl overflow-hidden shadow-lg">
            <video
              src={url}
              poster={thumbnail || undefined}
              controls
              autoPlay
              className="w-full h-full object-contain"
              playsInline
            />
          </div>
          <div className="flex gap-3 justify-center">
            <Button onClick={handleDownload} size="lg" className="px-8">
              تحميل المقطع
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => window.close()}
            >
              إغلاق
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">جاري التحميل...</p>
          </div>
        </div>
      }
    >
      <PreviewContent />
    </Suspense>
  );
}
