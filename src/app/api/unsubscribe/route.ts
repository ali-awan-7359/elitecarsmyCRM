import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { unsubscribe } from "@/lib/exclusions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const leadId = request.nextUrl.searchParams.get("lead");
  const email = request.nextUrl.searchParams.get("email");

  let target = email;
  if (!target && leadId) {
    const lead = db.prepare("SELECT email FROM leads WHERE id = ?").get(Number(leadId)) as { email?: string } | undefined;
    target = lead?.email ?? "";
  }

  if (target) unsubscribe(target, "one-click unsubscribe link");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribed</title>
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#07080a;color:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px">
<div style="max-width:480px;background:#0a0b0d;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:32px">
<h1 style="margin:0 0 12px;font-size:20px">You have been unsubscribed</h1>
<p style="margin:0 0 8px;color:#a1a1aa;line-height:1.6;font-size:14px">${target} has been added to our suppression list. No further emails will be sent to this address.</p>
<p style="margin:0;color:#71717a;line-height:1.6;font-size:13px">If this was a mistake, reply to any email from us and we will remove the suppression entry.</p>
</div></body></html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}