"use client";

import { MapPinIcon, PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteVenue, saveVenue, setVenueActive } from "@/actions/venues";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Venue = {
  id: string;
  name: string;
  address: string | null;
  isActive: boolean;
};

export function VenueEditor({ venues }: { venues: Venue[] }) {
  const [editing, setEditing] = useState<Venue | "new" | null>(venues.length ? null : "new");
  return (
    <div className="space-y-4">
      {venues.map((v) => (
        <Card key={v.id}>
          <CardContent className="flex flex-wrap items-center gap-3 py-3">
            <MapPinIcon className="size-5 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">
                {v.name} {v.isActive ? null : <Badge variant="outline">inactive</Badge>}
              </div>
              {v.address ? <div className="truncate text-sm text-muted-foreground">{v.address}</div> : null}
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing(v)}>
              Edit
            </Button>
            <VenueButtons id={v.id} name={v.name} active={v.isActive} />
          </CardContent>
        </Card>
      ))}
      {editing ? (
        <VenueForm
          key={editing === "new" ? "new" : editing.id}
          venue={editing === "new" ? null : editing}
          onDone={() => setEditing(null)}
        />
      ) : (
        <Button onClick={() => setEditing("new")}>
          <PlusIcon /> Add venue
        </Button>
      )}
    </div>
  );
}

function VenueButtons({ id, name, active }: { id: string; name: string; active: boolean }) {
  return (
    <>
      {active ? (
        <ConfirmButton
          label="Deactivate"
          title={`Deactivate ${name}?`}
          description="It can't be chosen for new meetings. Meetings already scheduled there keep it."
          success="Venue deactivated."
          action={() => setVenueActive(id, false)}
        />
      ) : (
        <ConfirmButton
          label="Activate"
          title={`Activate ${name}?`}
          success="Venue activated."
          action={() => setVenueActive(id, true)}
          destructive={false}
        />
      )}
      <ConfirmButton
        label="Delete"
        title={`Delete ${name}?`}
        description="Only possible if no meeting has ever used it."
        success="Venue deleted."
        action={() => deleteVenue(id)}
      />
    </>
  );
}

function VenueForm({ venue, onDone }: { venue: Venue | null; onDone: () => void }) {
  const [name, setName] = useState(venue?.name ?? "");
  const [address, setAddress] = useState(venue?.address ?? "");
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await saveVenue(venue?.id ?? null, { name, address });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Venue saved.");
      onDone();
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="v-name">Venue name</Label>
            <Input id="v-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Hotel / hall name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="v-addr">Address shown to members</Label>
            <Input id="v-addr" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={save} disabled={pending || !name}>
            Save venue
          </Button>
          <Button variant="outline" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
