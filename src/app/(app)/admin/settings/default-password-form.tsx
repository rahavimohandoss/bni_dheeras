"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveDefaultPassword } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/format";

export function DefaultPasswordForm({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="space-y-1.5">
          <Label htmlFor="default-password">Default password</Label>
          <Input
            id="default-password"
            className="max-w-xs font-mono"
            autoComplete="off"
            spellCheck={false}
            minLength={PASSWORD_MIN_LENGTH}
            maxLength={PASSWORD_MAX_LENGTH}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            New members sign in with their mobile number and this password, then choose their own. The President, VP
            or Secretary can reset a forgotten password back to it. Changing it also changes it for members who
            haven&apos;t chosen their own yet.
          </p>
        </div>
        <Button
          disabled={pending || value === initial}
          onClick={() =>
            start(async () => {
              const res = await saveDefaultPassword(value);
              if (res.ok) toast.success("Default password saved.");
              else toast.error(res.error);
            })
          }
        >
          Save default password
        </Button>
      </CardContent>
    </Card>
  );
}
