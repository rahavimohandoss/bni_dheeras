"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelPlan, registerSubstitute, requestLeave } from "@/actions/leave";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

type Choice = "substitute" | "medical" | "informed";

export function PlanDialog({ meetingId }: { meetingId: string }) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<Choice>("substitute");
  const [pending, start] = useTransition();

  function submit(formData: FormData) {
    start(async () => {
      const res =
        choice === "substitute"
          ? await registerSubstitute({
              meetingId,
              name: String(formData.get("name") ?? ""),
              phone: String(formData.get("phone") ?? ""),
              business: String(formData.get("business") ?? "") || undefined,
            })
          : await requestLeave({ meetingId, kind: choice, reason: String(formData.get("reason") ?? "") || undefined });
      if (!res.ok) return void toast.error(res.error);
      toast.success(
        choice === "substitute"
          ? "Substitute registered. The LVH team will confirm them at the door."
          : choice === "medical"
            ? "Medical leave requested."
            : "Thanks for letting the chapter know.",
      );
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Can&apos;t attend?</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Can&apos;t attend this meeting?</DialogTitle>
          <DialogDescription>A substitute keeps your attendance clean. You can change this until the meeting starts.</DialogDescription>
        </DialogHeader>
        <form action={submit} className="space-y-4">
          <RadioGroup value={choice} onValueChange={(v) => setChoice(v as Choice)} className="gap-3">
            <label className="flex items-start gap-3 rounded-lg border p-3">
              <RadioGroupItem value="substitute" className="mt-0.5" />
              <span>
                <span className="font-medium">Send a substitute</span>
                <span className="block text-sm text-muted-foreground">Counts as S, not an absence.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-lg border p-3">
              <RadioGroupItem value="medical" className="mt-0.5" />
              <span>
                <span className="font-medium">Medical leave</span>
                <span className="block text-sm text-muted-foreground">Counts as M once approved.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-lg border p-3">
              <RadioGroupItem value="informed" className="mt-0.5" />
              <span>
                <span className="font-medium">Just inform</span>
                <span className="block text-sm text-muted-foreground">Still counts as an absence (A).</span>
              </span>
            </label>
          </RadioGroup>

          {choice === "substitute" ? (
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sub-name">Substitute&apos;s name</Label>
                <Input id="sub-name" name="name" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sub-phone">Their mobile</Label>
                <Input id="sub-phone" name="phone" inputMode="tel" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sub-business">Their business (optional)</Label>
                <Input id="sub-business" name="business" />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="reason">Reason {choice === "informed" ? "(optional)" : ""}</Label>
              <Textarea id="reason" name="reason" required={choice === "medical"} />
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CancelPlanButton({ meetingId }: { meetingId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await cancelPlan(meetingId);
          if (res.ok) toast.success("Cancelled. You're expected at the meeting.");
          else toast.error(res.error);
        })
      }
    >
      Undo
    </Button>
  );
}
