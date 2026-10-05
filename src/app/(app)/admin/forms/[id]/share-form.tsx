"use client";

import { CopyIcon, DownloadIcon, ExternalLinkIcon } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useOrigin } from "@/lib/use-origin";

/** Link + printable QR. Unlike the attendance QR, this one is meant to stay the same. */
export function ShareForm({ slug }: { slug: string }) {
  const origin = useOrigin();
  const url = `${origin}/f/${slug}`;
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    if (!origin) return;
    QRCode.toDataURL(`${origin}/f/${slug}`, { margin: 1, width: 600 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [origin, slug]);
  return (
    <Card className="mb-4">
      <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {qr ? <img src={qr} alt="Form QR code" className="size-28 rounded-lg border" /> : <div className="size-28 rounded-lg bg-muted" />}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="truncate rounded-md bg-muted px-3 py-2 font-mono text-sm">{url}</div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(url).catch(() => {});
                toast.success("Link copied.");
              }}
            >
              <CopyIcon /> Copy link
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={url} target="_blank" rel="noopener">
                <ExternalLinkIcon /> Open
              </a>
            </Button>
            {qr ? (
              <Button asChild size="sm" variant="outline">
                <a href={qr} download={`form-${slug}-qr.png`}>
                  <DownloadIcon /> QR image
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
