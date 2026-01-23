import { NextResponse } from "next/server";
import { loadPreferences, savePreferences } from "../../../lib/qaStore";

export const runtime = "nodejs";

export async function GET() {
  const preferences = await loadPreferences();
  return NextResponse.json({ preferences });
}

export async function POST(request: Request) {
  try {
    const bodyText = await request.text();
    if (!bodyText.trim()) {
      const preferences = await loadPreferences();
      return NextResponse.json({ preferences });
    }
    const payload = JSON.parse(bodyText);
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "Invalid preferences payload" }, { status: 400 });
    }
    const preferences = await savePreferences(payload ?? {});
    return NextResponse.json({ preferences });
  } catch {
    return NextResponse.json({ error: "Invalid preferences payload" }, { status: 400 });
  }
}
