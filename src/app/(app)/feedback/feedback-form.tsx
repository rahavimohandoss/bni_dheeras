"use client";

import { SendIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { submitFeedback } from "@/actions/feedback";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function FeedbackForm() {
  const [kind, setKind] = useState<"suggestion" | "feedback">("suggestion");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await submitFeedback({ kind, message, anonymous });
          if (!res.ok) return void toast.error(res.error);
          setMessage("");
          setAnonymous(false);
          toast.success("Thank you! The Head Table will see it.");
        });
      }}
    >
      <div className="flex gap-1">
        {(["suggestion", "feedback"] as const).map((k) => (
          <Button key={k} type="button" size="sm" variant={kind === k ? "default" : "outline"} onClick={() => setKind(k)}>
            {k === "suggestion" ? "Suggestion" : "Feedback"}
          </Button>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fb-message">{kind === "suggestion" ? "Your suggestion" : "Your feedback"}</Label>
        <Textarea
          id="fb-message"
          rows={4}
          maxLength={2000}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={kind === "suggestion" ? "An idea to make our chapter better…" : "What's working, what isn't…"}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={anonymous} onCheckedChange={(v) => setAnonymous(!!v)} />
        Hide my name from the Head Table
      </label>
      <Button type="submit" disabled={pending || message.trim().length < 5}>
        <SendIcon /> Send
      </Button>
    </form>
  );
}
