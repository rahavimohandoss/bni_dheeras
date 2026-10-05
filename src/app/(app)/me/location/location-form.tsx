"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteMyLocation, saveMyLocation } from "@/actions/location";
import { LocationPicker, type PickedPlace } from "@/components/map/location-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";

type Initial = PickedPlace & { precision: "exact" | "area"; visible: boolean };

export function LocationForm({ initial }: { initial: Initial | null }) {
  const router = useRouter();
  const [place, setPlace] = useState<PickedPlace | null>(initial);
  const [area, setArea] = useState(initial?.area ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [precision, setPrecision] = useState<"exact" | "area">(initial?.precision ?? "exact");
  const [visible, setVisible] = useState(initial?.visible ?? false);
  const [pending, start] = useTransition();

  function save() {
    if (!place) return void toast.error("Set your business location on the map first.");
    start(async () => {
      const res = await saveMyLocation({
        lat: place.lat,
        lng: place.lng,
        address: place.address,
        area: area || place.area,
        city: city || place.city,
        precision,
        visible,
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(visible ? "Saved. Members can now find your business." : "Saved (hidden from members).");
      router.push("/near");
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex items-start justify-between gap-4 py-4">
          <div>
            <Label htmlFor="visible" className="text-base">
              Show my business on the member map
            </Label>
            <p className="text-sm text-muted-foreground">Off by default. You can switch it off any time.</p>
          </div>
          <Switch id="visible" checked={visible} onCheckedChange={setVisible} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 py-4">
          <LocationPicker
            value={place}
            onChange={(p) => {
              setPlace(p);
              if (p.area) setArea(p.area);
              if (p.city) setCity(p.city);
            }}
          />
          {place?.address ? <p className="text-sm text-muted-foreground">{place.address}</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="area">Area / locality</Label>
              <Input id="area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Anna Nagar" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Madurai" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <Label className="mb-3 block text-base">How exactly should members see it?</Label>
          <RadioGroup value={precision} onValueChange={(v) => setPrecision(v as "exact" | "area")} className="gap-3">
            <label className="flex items-start gap-3 rounded-lg border p-3">
              <RadioGroupItem value="exact" className="mt-0.5" />
              <span>
                <span className="font-medium">Exact pin</span>
                <span className="block text-sm text-muted-foreground">For a shop or office. Members get directions to the door.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-lg border p-3">
              <RadioGroupItem value="area" className="mt-0.5" />
              <span>
                <span className="font-medium">Area only</span>
                <span className="block text-sm text-muted-foreground">
                  For a business run from home. Members see your locality and an approximate pin (about 500 m), never your
                  street address.
                </span>
              </span>
            </label>
          </RadioGroup>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={pending}>
          Save location
        </Button>
        {initial ? (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await deleteMyLocation();
                if (!res.ok) return void toast.error(res.error);
                toast.success("Location removed.");
                router.refresh();
                setPlace(null);
              })
            }
          >
            Remove my location
          </Button>
        ) : null}
      </div>
    </div>
  );
}
