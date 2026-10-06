"use client";

import { PlusIcon, SearchIcon, UploadIcon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { addMember, type ImportReport, importMembersCsv, setMemberStatus, updateMember } from "@/actions/members";
import { ConfirmButton } from "@/components/confirm-button";
import { PasswordButton } from "@/components/password-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Row = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  businessName: string | null;
  category: string | null;
  status: "active" | "inactive";
  joinedOn: string | null;
  isAdmin: boolean;
  isChapterMember: boolean;
  mustChangePassword: boolean;
};

const PAGE_SIZE = 25;
type Filter = "active" | "inactive" | "all";

export function MembersAdmin({ members, meId }: { members: Row[]; meId: string }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("active");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter(
      (m) =>
        (filter === "all" || m.status === filter) &&
        (!q || [m.fullName, m.email, m.phone, m.businessName, m.category].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [members, query, filter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const counts: Record<Filter, number> = {
    active: members.filter((m) => m.status === "active").length,
    inactive: members.filter((m) => m.status === "inactive").length,
    all: members.length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <SearchIcon className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search members"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Button onClick={() => setEditing("new")}>
          <PlusIcon /> Add member
        </Button>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <UploadIcon /> Import CSV
        </Button>
      </div>
      <div className="flex gap-1">
        {(["active", "inactive", "all"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => {
              setFilter(f);
              setPage(1);
            }}
          >
            {f === "active" ? "Active" : f === "inactive" ? "Inactive" : "All"} ({counts[f]})
          </Button>
        ))}
      </div>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Business</TableHead>
              <TableHead className="hidden lg:table-cell">Email / phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                  No members found.
                </TableCell>
              </TableRow>
            ) : null}
            {shown.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1 font-medium">
                    {m.fullName}
                    {m.isAdmin ? <Badge variant="outline">admin</Badge> : null}
                    {!m.isChapterMember ? (
                      <Badge variant="outline" title="Doesn't appear in attendance, PALMS or the member list">
                        not a member
                      </Badge>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground md:hidden">{m.businessName}</div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div>{m.businessName}</div>
                  <div className="text-xs text-muted-foreground">{m.category}</div>
                </TableCell>
                <TableCell className="hidden text-sm lg:table-cell">
                  <div>{m.email}</div>
                  <div className="text-muted-foreground">{m.phone}</div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={m.status === "active" ? "secondary" : "outline"}>{m.status}</Badge>
                    {m.status === "active" && m.mustChangePassword ? (
                      <Badge variant="outline" title="Hasn't signed in and set their own password yet">
                        default password
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(m)}>
                    Edit
                  </Button>
                  {m.status === "active" ? <PasswordButton memberId={m.id} name={m.fullName} /> : null}
                  {m.id === meId ? null : m.status === "active" ? (
                    <ConfirmButton
                      label="Deactivate"
                      title={`Deactivate ${m.fullName}?`}
                      description="They're signed out everywhere, can't sign in, and are no longer expected at meetings. Their history stays, and you can reactivate them later."
                      success={`${m.fullName} deactivated.`}
                      action={() => setMemberStatus(m.id, "inactive")}
                    />
                  ) : (
                    <ConfirmButton
                      label="Reactivate"
                      title={`Reactivate ${m.fullName}?`}
                      description="They can sign in again and are expected at meetings."
                      success={`${m.fullName} reactivated.`}
                      action={() => setMemberStatus(m.id, "active")}
                      destructive={false}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {pageCount > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>
            Previous
          </Button>
          <span className="text-muted-foreground tabular-nums">
            Page {current} of {pageCount}
          </span>
          <Button variant="outline" size="sm" disabled={current >= pageCount} onClick={() => setPage(current + 1)}>
            Next
          </Button>
        </div>
      ) : null}
      {editing ? <MemberDialog row={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

function MemberDialog({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [isChapterMember, setIsChapterMember] = useState(row?.isChapterMember ?? true);
  function submit(formData: FormData) {
    const input = {
      fullName: String(formData.get("fullName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      businessName: String(formData.get("businessName") ?? ""),
      category: String(formData.get("category") ?? ""),
      joinedOn: String(formData.get("joinedOn") ?? ""),
    };
    start(async () => {
      const res = row ? await updateMember(row.id, input, isChapterMember) : await addMember(input, isChapterMember);
      if (!res.ok) return void toast.error(res.error);
      toast.success(row ? "Member updated." : "Member added. Tap Password next to their name to send their login on WhatsApp.");
      onClose();
    });
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row ? `Edit ${row.fullName}` : "Add member"}</DialogTitle>
          <DialogDescription>
            The mobile number is their login ID. New members start on the default password and choose their own at the
            first sign-in.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-3">
          <Field name="fullName" label="Full name" defaultValue={row?.fullName} required />
          <Field name="email" label="Email" type="email" defaultValue={row?.email} required />
          <Field name="phone" label="Mobile" defaultValue={row?.phone ?? ""} />
          <Field name="businessName" label="Business name" defaultValue={row?.businessName ?? ""} />
          <Field name="category" label="Category / classification" defaultValue={row?.category ?? ""} />
          <Field name="joinedOn" label="Joined on" type="date" defaultValue={row?.joinedOn ?? ""} />
          <label className="flex items-start gap-2 text-sm">
            <Checkbox className="mt-0.5" checked={isChapterMember} onCheckedChange={(v) => setIsChapterMember(!!v)} />
            <span>
              Chapter member
              <span className="block text-xs text-muted-foreground">
                Untick for admin-only logins: they don&apos;t appear in attendance, PALMS, the member list or celebrations.
              </span>
            </span>
          </label>
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

function Field(props: { name: string; label: string; type?: string; defaultValue?: string; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`f-${props.name}`}>{props.label}</Label>
      <Input
        id={`f-${props.name}`}
        name={props.name}
        type={props.type ?? "text"}
        defaultValue={props.defaultValue}
        required={props.required}
      />
    </div>
  );
}

function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [report, setReport] = useState<ImportReport | null>(null);
  const [pending, start] = useTransition();
  async function onFile(file: File) {
    const text = await file.text();
    start(async () => {
      const res = await importMembersCsv(text);
      if (!res.ok) return void toast.error(res.error);
      setReport(res.data);
      toast.success(`${res.data.created} member(s) added.`);
    });
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setReport(null);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import members from CSV</DialogTitle>
          <DialogDescription>
            Columns: Name, Email (required), Mobile, Business, Category, Joined on. Export the chapter roster from BNI
            Connect, open it in Excel, and save as CSV. Existing emails are skipped.
          </DialogDescription>
        </DialogHeader>
        <Input type="file" accept=".csv,text/csv" disabled={pending} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        {report ? (
          <div className="space-y-1 text-sm">
            <p>
              Added <b>{report.created}</b>, skipped <b>{report.skipped.length}</b>.
            </p>
            {report.skipped.slice(0, 15).map((s) => (
              <p key={s.row} className="text-muted-foreground">
                Row {s.row}: {s.reason}
              </p>
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
