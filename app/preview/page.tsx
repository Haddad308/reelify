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
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-3xl bg-gray-800 border-gray-700">
        <CardHeader className="text-center">
          <CardTitle className="text-white text-xl">{title}</CardTitle>
          {duration && (
            <p className="text-gray-400 text-sm">{duration} ثانية</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
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
            <Button onClick={handleDownload} size="lg">
              تحميل المقطع
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => window.close()}
              className="bg-transparent text-white border-gray-600 hover:bg-gray-700"
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
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
          <p className="text-white">جاري التحميل...</p>
        </div>
      }
    >
      <PreviewContent />
    </Suspense>
  );
}
