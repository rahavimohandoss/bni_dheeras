"use client";

import { XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { assignRole, createTerm, removeRole, setAdmin } from "@/actions/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Term = { id: string; name: string; startsOn: string; endsOn: string };
type MemberOpt = { id: string; fullName: string; isAdmin: boolean };

export function RolesAdmin({
  meId,
  terms,
  selectedTermId,
  members,
  assignments,
  roles,
}: {
  meId: string;
  terms: Term[];
  selectedTermId: string | null;
  members: MemberOpt[];
  assignments: { id: string; role: string; memberId: string }[];
  roles: { key: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [memberId, setMemberId] = useState("");
  const [role, setRole] = useState("");
  const nameOf = (id: string) => members.find((m) => m.id === id)?.fullName ?? "Former member";

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error((res as { error: string }).error);
      else if (ok) toast.success(ok);
    });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Label>Term</Label>
          <Select value={selectedTermId ?? ""} onValueChange={(id) => router.push(`/admin/roles?term=${id}`)}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Choose a term" />
            </SelectTrigger>
            <SelectContent>
              {terms.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedTermId ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assign a role</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 sm:flex-row">
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue placeholder="Member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                disabled={pending || !memberId || !role}
                onClick={() => run(() => assignRole(selectedTermId, memberId, role), "Role assigned.")}
              >
                Assign
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {roles.map((r) => {
            const holders = assignments.filter((a) => a.role === r.key);
            return (
              <Card key={r.key}>
                <CardContent className="py-3">
                  <div className="mb-2 text-sm font-semibold">
                    {r.label}
                    {r.key === "president" ? (
                      <span className="ml-1.5 font-normal text-muted-foreground">· full access, same as Admin</span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {holders.length === 0 ? <span className="text-sm text-muted-foreground">Nobody</span> : null}
                    {holders.map((h) => (
                      <Badge key={h.id} variant="secondary" className="gap-1">
                        {nameOf(h.memberId)}
                        <button
                          type="button"
                          aria-label={`Remove ${nameOf(h.memberId)}`}
                          onClick={() => run(() => removeRole(h.id))}
                        >
                          <XIcon className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <NewTerm terms={terms} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">App admins</CardTitle>
            <CardDescription>The President of the current term has the same access without this tick.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-80 space-y-2 overflow-y-auto">
            {members.map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={m.isAdmin}
                  disabled={pending || m.id === meId}
                  onCheckedChange={(v) => run(() => setAdmin(m.id, !!v))}
                />
                {m.fullName}
              </label>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function NewTerm({ terms }: { terms: Term[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [copy, setCopy] = useState(true);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Start a new term</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-2"
          action={(fd) =>
            start(async () => {
              const res = await createTerm(
                {
                  name: String(fd.get("name") ?? ""),
                  startsOn: String(fd.get("startsOn") ?? ""),
                  endsOn: String(fd.get("endsOn") ?? ""),
                },
                copy ? terms[0]?.id : undefined,
              );
              if (!res.ok) return void toast.error(res.error);
              toast.success("Term created.");
              router.push(`/admin/roles?term=${res.data.id}`);
            })
          }
        >
          <Input name="name" placeholder="e.g. Apr–Sep 2027" required />
          <div className="grid grid-cols-2 gap-2">
            <Input name="startsOn" type="date" required />
            <Input name="endsOn" type="date" required />
          </div>
          {terms.length ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={copy} onCheckedChange={(v) => setCopy(!!v)} /> Copy roles from {terms[0].name}
            </label>
          ) : null}
          <Button type="submit" disabled={pending} className="w-full">
            Create term
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
