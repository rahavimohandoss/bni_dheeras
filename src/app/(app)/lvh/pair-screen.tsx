"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { newPairingCode, revokeKiosk } from "@/actions/kiosk";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function PairScreen() {
  const [label, setLabel] = useState("Projector laptop");
  const [code, setCode] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        {code ? (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              On the screen, open <b>{typeof window !== "undefined" ? window.location.origin : ""}/kiosk</b> and enter:
            </p>
            <div className="my-2 font-mono text-4xl font-bold tracking-[0.3em]">{code}</div>
            <p className="text-xs text-muted-foreground">Valid for 10 minutes, once.</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setCode(null)}>
              Done
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Screen name" />
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await newPairingCode(label);
                  if (res.ok) setCode(res.data.code);
                  else toast.error(res.error);
                })
              }
            >
              Pair a venue screen
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RevokeScreen({ id }: { id: string }) {
  return (
    <ConfirmButton
      label="Remove"
      title="Remove this venue screen?"
      description="It stops showing the check-in QR right away. Pair it again with a new code if needed."
      success="Screen removed."
      action={() => revokeKiosk(id)}
    />
  );
}
