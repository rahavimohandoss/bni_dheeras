"use client";

import { PencilIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { assignRole, createTerm, deleteTerm, removeRole, setAdmin, updateTerm } from "@/actions/roles";
import { ConfirmButton } from "@/components/confirm-button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Term = { id: string; name: string; startsOn: string; endsOn: string };
type MemberOpt = { id: string; fullName: string; isAdmin: boolean; isChapterMember: boolean };

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
  const [editingTerm, setEditingTerm] = useState(false);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.fullName ?? "Former member";
  const selectedTerm = terms.find((t) => t.id === selectedTermId) ?? null;

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
          {selectedTerm ? (
            <>
              <span className="text-sm text-muted-foreground">
                {selectedTerm.startsOn} → {selectedTerm.endsOn}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setEditingTerm(true)}>
                <PencilIcon /> Edit
              </Button>
              <ConfirmButton
                label="Delete"
                title={`Delete the term "${selectedTerm.name}"?`}
                description="Its role list is deleted too. The current term can't be deleted."
                success="Term deleted."
                action={() => deleteTerm(selectedTerm.id)}
                redirectTo="/admin/roles"
              />
            </>
          ) : null}
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
                  {members
                    .filter((m) => m.isChapterMember)
                    .map((m) => (
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
                      <Badge key={h.id} variant="secondary" className="gap-0.5 pr-0.5">
                        {nameOf(h.memberId)}
                        <ConfirmButton
                          label=""
                          icon={<XIcon className="size-3" />}
                          ariaLabel={`Remove ${nameOf(h.memberId)}`}
                          className="size-5 p-0"
                          title={`Remove ${nameOf(h.memberId)} as ${r.label}?`}
                          description="Their permissions for this role end right away."
                          confirmLabel="Remove"
                          success="Role removed."
                          action={() => removeRole(h.id)}
                        />
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
            {/* Current admins first, so they're visible without scrolling. */}
            {[...members]
              .sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin))
              .map((m) => (
                <AdminToggle key={m.id} member={m} disabled={m.id === meId} />
              ))}
          </CardContent>
        </Card>
      </div>

      {editingTerm && selectedTerm ? <EditTerm term={selectedTerm} onClose={() => setEditingTerm(false)} /> : null}
    </div>
  );
}

/** Admin tick with a confirmation: it grants or removes full access. */
function AdminToggle({ member: m, disabled }: { member: MemberOpt; disabled: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const next = !m.isAdmin;
  return (
    <>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={m.isAdmin} disabled={disabled || pending} onCheckedChange={() => setOpen(true)} />
        {m.fullName}
      </label>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{next ? `Make ${m.fullName} an app admin?` : `Remove ${m.fullName}'s admin access?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {next
                ? "Admins can do everything in the app: members, roles, settings, attendance corrections and the audit log."
                : "They keep the permissions of any roles they hold this term."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              variant={next ? "default" : "destructive"}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await setAdmin(m.id, next);
                  if (!res.ok) return void toast.error(res.error);
                  setOpen(false);
                  toast.success(next ? "Admin access granted." : "Admin access removed.");
                  router.refresh();
                })
              }
            >
              {next ? "Make admin" : "Remove admin"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function EditTerm({ term, onClose }: { term: Term; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit term</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-3"
          action={(fd) =>
            start(async () => {
              const res = await updateTerm(term.id, {
                name: String(fd.get("name") ?? ""),
                startsOn: String(fd.get("startsOn") ?? ""),
                endsOn: String(fd.get("endsOn") ?? ""),
              });
              if (!res.ok) return void toast.error(res.error);
              toast.success("Term updated.");
              onClose();
              router.refresh();
            })
          }
        >
          <Input name="name" defaultValue={term.name} required />
          <div className="grid grid-cols-2 gap-2">
            <Input name="startsOn" type="date" defaultValue={term.startsOn} required />
            <Input name="endsOn" type="date" defaultValue={term.endsOn} required />
          </div>
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
