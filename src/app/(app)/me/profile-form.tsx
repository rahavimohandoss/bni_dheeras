"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveProfile, setMyImage } from "@/actions/profile";
import { ImageUploader } from "@/components/image-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Values = {
  businessName: string;
  about: string;
  website: string;
  whatsapp: string;
  videoUrl: string;
  instagram: string;
  facebook: string;
  linkedin: string;
  youtube: string;
  x: string;
  dateOfBirth: string;
  anniversaryDate: string;
};

export function ProfileForm({
  initial,
  photoUrl,
  logoUrl,
  category,
}: {
  initial: Values;
  photoUrl: string | null;
  logoUrl: string | null;
  category: string | null;
}) {
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <ImageUploader kind="photo" label="Photo" rounded currentUrl={photoUrl} onUploaded={(key) => setMyImage("photo", key)} />
        <ImageUploader kind="logo" label="Logo" currentUrl={logoUrl} onUploaded={(key) => setMyImage("logo", key)} />
      </div>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await saveProfile(v);
            if (res.ok) toast.success("Profile saved.");
            else toast.error(res.error);
          });
        }}
      >
        <Field label="Business name">
          <Input value={v.businessName} onChange={set("businessName")} />
        </Field>
        <Field label="Category" hint="Set by the Membership Committee.">
          <Input value={category ?? ""} disabled />
        </Field>
        <div className="sm:col-span-2">
          <Field label="What your business does">
            <Textarea rows={4} value={v.about} onChange={set("about")} placeholder="Products, services, who you serve…" />
          </Field>
        </div>
        <Field label="Website">
          <Input value={v.website} onChange={set("website")} placeholder="yourbusiness.com" />
        </Field>
        <Field label="WhatsApp number">
          <Input value={v.whatsapp} onChange={set("whatsapp")} inputMode="tel" />
        </Field>
        <Field label="Date of birth" hint="Only the President, VP and Secretary see this, for chapter celebrations.">
          <Input type="date" value={v.dateOfBirth} onChange={set("dateOfBirth")} />
        </Field>
        <Field label="Wedding anniversary" hint="Optional. Also only for the Head Table's celebrations list.">
          <Input type="date" value={v.anniversaryDate} onChange={set("anniversaryDate")} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Business presentation video link" hint="YouTube links play right on your profile.">
            <Input value={v.videoUrl} onChange={set("videoUrl")} placeholder="https://youtu.be/…" />
          </Field>
        </div>
        <Field label="Instagram">
          <Input value={v.instagram} onChange={set("instagram")} placeholder="instagram.com/yourpage" />
        </Field>
        <Field label="Facebook">
          <Input value={v.facebook} onChange={set("facebook")} placeholder="facebook.com/yourpage" />
        </Field>
        <Field label="LinkedIn">
          <Input value={v.linkedin} onChange={set("linkedin")} placeholder="linkedin.com/in/you" />
        </Field>
        <Field label="YouTube channel">
          <Input value={v.youtube} onChange={set("youtube")} placeholder="youtube.com/@yourchannel" />
        </Field>
        <Field label="X (Twitter)">
          <Input value={v.x} onChange={set("x")} placeholder="x.com/you" />
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            Save profile
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <Label asChild>
        <span>{label}</span>
      </Label>
      {children}
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}
