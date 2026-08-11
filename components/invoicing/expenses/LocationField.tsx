"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface LocationValue {
  location: string;
  locationLat: number | null;
  locationLng: number | null;
}

/** [Pin My Location] uses the browser's own geolocation — no external
 * reverse-geocoding service is wired up (none exists in this codebase), so
 * the pinned coordinates are shown as an editable "lat, lng" label the user
 * can rename to something readable. [Add Location] just reveals the manual
 * text field for anyone who'd rather type an address. Permission denial,
 * an unsupported browser, or a timeout all fail quietly into a toast —
 * manual entry always keeps working. */
export function LocationField({ value, onChange }: { value: LocationValue; onChange: (v: LocationValue) => void }) {
  const [showInput, setShowInput] = useState(Boolean(value.location));
  const [locating, setLocating] = useState(false);

  function handlePinLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Location isn't supported in this browser. Enter it manually instead.");
      setShowInput(true);
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const { latitude, longitude } = position.coords;
        setShowInput(true);
        onChange({
          location: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
          locationLat: latitude,
          locationLng: longitude,
        });
      },
      (error) => {
        setLocating(false);
        setShowInput(true);
        if (error.code === error.PERMISSION_DENIED) {
          toast.error("Location permission denied. Enter it manually instead.");
        } else if (error.code === error.TIMEOUT) {
          toast.error("Getting your location timed out. Enter it manually instead.");
        } else {
          toast.error("Couldn't get your location. Enter it manually instead.");
        }
      },
      { timeout: 10_000 }
    );
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Location</Label>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handlePinLocation} disabled={locating}>
          {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
          Pin My Location
        </Button>
        {!showInput && (
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setShowInput(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add Location
          </Button>
        )}
      </div>
      {showInput && (
        <Input
          value={value.location}
          onChange={(e) => onChange({ ...value, location: e.target.value })}
          placeholder="e.g. Warehouse, Mumbai"
          className="mt-1.5"
        />
      )}
    </div>
  );
}
