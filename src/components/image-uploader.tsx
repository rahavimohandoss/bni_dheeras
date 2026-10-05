"use client";

import { CameraIcon, Loader2Icon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { requestImageUpload } from "@/actions/uploads";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/image-compress";
import { cn } from "@/lib/utils";

/**
 * Pick → compress in the browser → PUT to storage (R2 presigned URL) → hand
 * the stored key to `onUploaded`, which saves it on the server.
 */
export function ImageUploader({
  kind,
  currentUrl,
  label,
  rounded,
  onUploaded,
}: {
  kind: "photo" | "logo";
  currentUrl: string | null;
  label: string;
  rounded?: boolean;
  onUploaded: (key: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(currentUrl);
  const [busy, setBusy] = useState(false);

  async function handle(file: File) {
    setBusy(true);
    try {
      const blob = await compressImage(file, kind === "photo" ? 800 : 600);
      const target = await requestImageUpload({ kind, contentType: blob.type as "image/webp", size: blob.size });
      if (!target.ok) throw new Error(target.error);
      const put = await fetch(target.data.uploadUrl, { method: "PUT", body: blob, headers: target.data.headers });
      if (!put.ok) throw new Error("Upload failed. Check your connection and try again.");
      const saved = await onUploaded(target.data.key);
      if (!saved.ok) throw new Error(saved.error ?? "Couldn't save the image.");
      setPreview(URL.createObjectURL(blob));
      toast.success(`${label} updated.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div
        className={cn(
          "flex size-20 shrink-0 items-center justify-center overflow-hidden border bg-muted",
          rounded ? "rounded-full" : "rounded-xl",
        )}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={label} className={cn("size-full", kind === "logo" ? "object-contain" : "object-cover")} />
        ) : (
          <CameraIcon className="size-6 text-muted-foreground" />
        )}
      </div>
      <div>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <Loader2Icon className="animate-spin" /> : null}
          {preview ? `Change ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`}
        </Button>
        <p className="mt-1 text-xs text-muted-foreground">JPG or PNG. It&apos;s resized automatically.</p>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])}
      />
    </div>
  );
}
