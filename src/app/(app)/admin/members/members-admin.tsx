"use client";

import { PlusIcon, SearchIcon, UploadIcon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { addMember, type ImportReport, importMembersCsv, setMemberStatus, updateMember } from "@/actions/members";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { PasswordButton } from "@/components/password-button";
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
  mustChangePassword: boolean;
};

export function MembersAdmin({ members, meId }: { members: Row[]; meId: string }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      [m.fullName, m.email, m.phone, m.businessName, m.category].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [members, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <SearchIcon className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search members" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Button onClick={() => setEditing("new")}>
          <PlusIcon /> Add member
        </Button>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <UploadIcon /> Import CSV
        </Button>
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
            {filtered.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="font-medium">
                    {m.fullName} {m.isAdmin ? <Badge variant="outline">admin</Badge> : null}
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
                  {m.id !== meId ? <StatusToggle id={m.id} status={m.status} /> : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {editing ? <MemberDialog row={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

function StatusToggle({ id, status }: { id: string; status: "active" | "inactive" }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await setMemberStatus(id, status === "active" ? "inactive" : "active");
          if (!res.ok) toast.error(res.error);
        })
      }
    >
      {status === "active" ? "Deactivate" : "Reactivate"}
    </Button>
  );
}

function MemberDialog({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const [pending, start] = useTransition();
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
      const res = row ? await updateMember(row.id, input) : await addMember(input);
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
