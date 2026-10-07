"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Users,
  Warehouse as WarehouseIcon,
  Store,
  Building,
  Briefcase,
  Plus,
  ShieldCheck,
  Loader2,
  UserCheck,
  Truck,
  UserSquare2,
  Pencil,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type SetupData, LocationType, nextCode } from "@/lib/business-structure";
import { saveBusinessSetupAction, type AssignedBusinessData } from "@/services/business-structure";

interface BusinessStructureTreeProps {
  saved: SetupData;
  assignedBusiness?: AssignedBusinessData;
  onSaved: (updated: SetupData) => void;
  onOpenTab: (tabId: "overview" | "tables" | "hierarchy" | "portals" | "modules" | "flows" | "deals" | "roadmap") => void;
}

export function BusinessStructureTree({
  saved,
  assignedBusiness,
  onSaved,
  onOpenTab,
}: BusinessStructureTreeProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<LocationType>("WAREHOUSE");
  const [locName, setLocName] = useState("");
  const [locAddress, setLocAddress] = useState("");
  const [locMapPin, setLocMapPin] = useState("");
  const [saving, setSaving] = useState(false);

  // Edit location state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingLocCode, setEditingLocCode] = useState<string | null>(null);

  // Company information (defaults to Company 1 / First Entity if empty)
  const entity = saved.entities[0] ?? {
    code: "E001",
    legalName: "Company 1 Legal Entity",
    gstin: "27AAAAA0000A1Z5",
    registeredAddress: "Registered Corporate Address",
  };

  const business = saved.businesses[0] ?? {
    code: "B001",
    entityCode: entity.code,
    name: "Company 1",
    operationalAddress: "Headquarters & Operations",
  };

  const warehouses = saved.locations.filter((l) => l.type === "WAREHOUSE");
  const stores = saved.locations.filter((l) => l.type === "RETAIL_STORE");
  const backOffices = saved.locations.filter((l) => l.type === "OFFICE");

  const openAddModal = (type: LocationType) => {
    setModalType(type);
    setLocName("");
    setLocAddress("");
    setLocMapPin("");
    setModalOpen(true);
  };

  const openEditModal = (code: string) => {
    const loc = saved.locations.find((l) => l.code === code);
    if (!loc) return;
    setEditingLocCode(code);
    setLocName(loc.name);
    setLocAddress(loc.address ?? "");
    setLocMapPin(loc.mapPin ?? "");
    setEditModalOpen(true);
  };

  const handleAddLocation = async () => {
    if (!locName.trim()) {
      toast.error("Location name is required.");
      return;
    }
    setSaving(true);

    // Ensure entity & business exist in draft if empty
    const entities = saved.entities.length
      ? saved.entities
      : [{ code: entity.code, legalName: entity.legalName, gstin: entity.gstin, registeredAddress: entity.registeredAddress }];
    const businesses = saved.businesses.length
      ? saved.businesses
      : [{ code: business.code, entityCode: entity.code, name: business.name, operationalAddress: business.operationalAddress }];

    const newLocCode = nextCode("L", saved.locations);
    const updatedLocations = [
      ...saved.locations,
      {
        code: newLocCode,
        businessCode: business.code,
        type: modalType,
        name: locName.trim(),
        address: locAddress.trim(),
        mapPin: locMapPin.trim(),
      },
    ];

    const updatedSetup: SetupData = {
      ...saved,
      entities,
      businesses,
      locations: updatedLocations,
    };

    const res = await saveBusinessSetupAction(updatedSetup);
    setSaving(false);

    if (res.success) {
      onSaved(res.data);
      setModalOpen(false);
      const label = modalType === "WAREHOUSE" ? "Warehouse" : modalType === "RETAIL_STORE" ? "Retail Store" : "Back Office";
      toast.success(`${label} added successfully.`);
    } else {
      toast.error(res.errors.join(", "));
    }
  };

  const handleEditLocation = async () => {
    if (!editingLocCode || !locName.trim()) {
      toast.error("Location name is required.");
      return;
    }
    setSaving(true);

    const updatedLocations = saved.locations.map((l) =>
      l.code === editingLocCode
        ? { ...l, name: locName.trim(), address: locAddress.trim(), mapPin: locMapPin.trim() }
        : l
    );

    const updatedSetup: SetupData = {
      ...saved,
      locations: updatedLocations,
    };

    const res = await saveBusinessSetupAction(updatedSetup);
    setSaving(false);

    if (res.success) {
      onSaved(res.data);
      setEditModalOpen(false);
      toast.success("Location updated successfully.");
    } else {
      toast.error(res.errors.join(", "));
    }
  };

  return (
    <div className="space-y-6">
      {/* Visual Hierarchy Root Tree */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-xs">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">BUSINESS STRUCTURE</h2>
            <p className="text-xs text-muted-foreground">Complete organizational hierarchy, locations & assigned business</p>
          </div>
        </div>

        {/* Tree Layout Container */}
        <div className="mt-6 space-y-8">
          {/* SECTION 1: TEAM MANAGEMENT */}
          <div className="relative pl-6 sm:pl-8 border-l-2 border-blue-500/30">
            <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-blue-500 ring-4 ring-background" />

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">1. TEAM MANAGEMENT</span>
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Users className="h-3 w-3" /> {saved.members.length} Member{saved.members.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                <Button variant="outline" size="sm" onClick={() => onOpenTab("hierarchy")} className="h-7 text-xs gap-1">
                  View Hierarchy Chart →
                </Button>
              </div>

              {/* Team Management Child Node: Hierarchy */}
              <Card className="bg-muted/30">
                <CardHeader className="p-3 sm:p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <Users className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold">Hierarchy</CardTitle>
                        <CardDescription className="text-xs">
                          Employee reporting structure, designations, and workspace roles
                        </CardDescription>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => onOpenTab("hierarchy")} className="text-xs font-medium text-primary">
                      Manage Hierarchy
                    </Button>
                  </div>
                </CardHeader>
                {saved.members.length > 0 && (
                  <CardContent className="px-3 pb-3 sm:px-4 pt-0">
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {saved.members.slice(0, 6).map((m) => (
                        <span key={m.code} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-xs">
                          <UserCheck className="h-3 w-3 text-blue-500" />
                          <span className="font-medium">{m.name}</span>
                          {m.email && <span className="text-[10px] text-muted-foreground">({m.email})</span>}
                        </span>
                      ))}
                      {saved.members.length > 6 && (
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground font-medium">
                          +{saved.members.length - 6} more
                        </span>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>
          </div>

          {/* SECTION 2: COMPANY 1 */}
          <div className="relative pl-6 sm:pl-8 border-l-2 border-emerald-500/30">
            <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-emerald-500 ring-4 ring-background" />

            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">2. COMPANY</span>
                  <Badge variant="outline" className="font-bold border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                    {business.name}
                  </Badge>
                </div>
                <Button variant="outline" size="sm" onClick={() => onOpenTab("tables")} className="h-7 text-xs gap-1">
                  Edit Company Setup →
                </Button>
              </div>

              {/* Company Box Node */}
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-emerald-500/10 pb-3">
                  <div>
                    <h3 className="font-semibold text-sm text-foreground">{business.name}</h3>
                    <p className="text-xs text-muted-foreground">{entity.legalName} {business.operationalAddress ? `· ${business.operationalAddress}` : ""}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">Company ID: {business.code}</Badge>
                </div>

                {/* Sub-tree under Company 1 */}
                <div className="grid gap-4 md:grid-cols-2">

                  {/* 2.1 GST */}
                  <Card size="sm" className="bg-background/80 border-border">
                    <CardHeader className="p-3">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <CardTitle className="text-sm font-semibold">GST Details</CardTitle>
                        <Badge variant="outline" className="ml-auto text-[10px] bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">One GST</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 text-xs space-y-1">
                      <p className="font-medium text-foreground">
                        GSTIN: <span className="font-mono text-primary">{entity.gstin || "Not set (Edit in Setup Tables)"}</span>
                      </p>
                      <p className="text-muted-foreground">Legal Name: {entity.legalName}</p>
                      {entity.registeredAddress && (
                        <p className="text-muted-foreground truncate">Address: {entity.registeredAddress}</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* 2.2 WAREHOUSE */}
                  <Card size="sm" className="bg-background/80 border-border">
                    <CardHeader className="p-3 flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-2">
                        <WarehouseIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <CardTitle className="text-sm font-semibold">Warehouses</CardTitle>
                        <Badge variant="secondary" className="text-[10px]">{warehouses.length}</Badge>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => openAddModal("WAREHOUSE")} className="h-6 px-2 text-xs font-semibold text-primary hover:bg-primary/10">
                        <Plus className="h-3 w-3 mr-0.5" /> Add Warehouse
                      </Button>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 space-y-1.5 text-xs">
                      {warehouses.length === 0 && (
                        <p className="text-muted-foreground italic text-[11px]">No warehouses added yet.</p>
                      )}
                      {warehouses.map((w) => (
                        <div key={w.code} className="flex items-center justify-between rounded-md border border-border bg-card p-2">
                          <div className="min-w-0 pr-2">
                            <p className="font-medium truncate text-foreground">{w.name}</p>
                            {w.address && <p className="text-[10px] text-muted-foreground truncate">{w.address}</p>}
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => openEditModal(w.code)}>
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* 2.3 RETAIL STORE */}
                  <Card size="sm" className="bg-background/80 border-border">
                    <CardHeader className="p-3 flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        <CardTitle className="text-sm font-semibold">Retail Stores</CardTitle>
                        <Badge variant="secondary" className="text-[10px]">{stores.length}</Badge>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => openAddModal("RETAIL_STORE")} className="h-6 px-2 text-xs font-semibold text-primary hover:bg-primary/10">
                        <Plus className="h-3 w-3 mr-0.5" /> Add Retail Store
                      </Button>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 space-y-1.5 text-xs">
                      {stores.length === 0 && (
                        <p className="text-muted-foreground italic text-[11px]">No retail stores added yet.</p>
                      )}
                      {stores.map((s) => (
                        <div key={s.code} className="flex items-center justify-between rounded-md border border-border bg-card p-2">
                          <div className="min-w-0 pr-2">
                            <p className="font-medium truncate text-foreground">{s.name}</p>
                            {s.address && <p className="text-[10px] text-muted-foreground truncate">{s.address}</p>}
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => openEditModal(s.code)}>
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* 2.4 BACK OFFICE */}
                  <Card size="sm" className="bg-background/80 border-border">
                    <CardHeader className="p-3 flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        <CardTitle className="text-sm font-semibold">Back Offices</CardTitle>
                        <Badge variant="secondary" className="text-[10px]">{backOffices.length}</Badge>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => openAddModal("OFFICE")} className="h-6 px-2 text-xs font-semibold text-primary hover:bg-primary/10">
                        <Plus className="h-3 w-3 mr-0.5" /> Add Back Office
                      </Button>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 space-y-1.5 text-xs">
                      {backOffices.length === 0 && (
                        <p className="text-muted-foreground italic text-[11px]">No back offices added yet.</p>
                      )}
                      {backOffices.map((bo) => (
                        <div key={bo.code} className="flex items-center justify-between rounded-md border border-border bg-card p-2">
                          <div className="min-w-0 pr-2">
                            <p className="font-medium truncate text-foreground">{bo.name}</p>
                            {bo.address && <p className="text-[10px] text-muted-foreground truncate">{bo.address}</p>}
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => openEditModal(bo.code)}>
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                </div>

                {/* 2.5 ASSIGNED BUSINESS */}
                <Card size="sm" className="bg-background border-border">
                  <CardHeader className="p-3">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                      <CardTitle className="text-sm font-semibold">Assigned Business</CardTitle>
                      <Badge variant="outline" className="text-[10px]">Buyers, Suppliers & Freelancers</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="grid gap-3 sm:grid-cols-3 text-xs">

                      {/* Buyers */}
                      <div className="rounded-md border border-border bg-muted/20 p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between font-semibold">
                          <span className="flex items-center gap-1 text-sky-700 dark:text-sky-300">
                            <UserSquare2 className="h-3.5 w-3.5" /> Buyers
                          </span>
                          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                            {assignedBusiness?.buyers.length ?? 0}
                          </Badge>
                        </div>
                        <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                          {assignedBusiness?.buyers.length === 0 && (
                            <p className="text-[10px] text-muted-foreground italic">No buyers linked</p>
                          )}
                          {assignedBusiness?.buyers.map((b) => (
                            <div key={b.id} className="text-[11px] font-medium text-foreground truncate">
                              • {b.name} {b.location ? <span className="text-[9px] text-muted-foreground">({b.location})</span> : ""}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Suppliers */}
                      <div className="rounded-md border border-border bg-muted/20 p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between font-semibold">
                          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                            <Truck className="h-3.5 w-3.5" /> Suppliers
                          </span>
                          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                            {assignedBusiness?.suppliers.length ?? 0}
                          </Badge>
                        </div>
                        <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                          {assignedBusiness?.suppliers.length === 0 && (
                            <p className="text-[10px] text-muted-foreground italic">No suppliers linked</p>
                          )}
                          {assignedBusiness?.suppliers.map((s) => (
                            <div key={s.id} className="text-[11px] font-medium text-foreground truncate">
                              • {s.name} {s.location ? <span className="text-[9px] text-muted-foreground">({s.location})</span> : ""}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Freelancers */}
                      <div className="rounded-md border border-border bg-muted/20 p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between font-semibold">
                          <span className="flex items-center gap-1 text-purple-700 dark:text-purple-300">
                            <Users className="h-3.5 w-3.5" /> Freelancers
                          </span>
                          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                            {assignedBusiness?.freelancers.length ?? 0}
                          </Badge>
                        </div>
                        <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                          {assignedBusiness?.freelancers.length === 0 && (
                            <p className="text-[10px] text-muted-foreground italic">No freelancers linked</p>
                          )}
                          {assignedBusiness?.freelancers.map((f) => (
                            <div key={f.id} className="text-[11px] font-medium text-foreground truncate">
                              • {f.name} {f.location ? <span className="text-[9px] text-muted-foreground">({f.location})</span> : ""}
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </CardContent>
                </Card>

              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Add Location Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              Add {modalType === "WAREHOUSE" ? "Warehouse" : modalType === "RETAIL_STORE" ? "Retail Store" : "Back Office"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-1.5">
              <Label htmlFor="loc-name">Location Name *</Label>
              <Input
                id="loc-name"
                placeholder={modalType === "WAREHOUSE" ? "e.g. Central Hub Warehouse" : modalType === "RETAIL_STORE" ? "e.g. Flagship Store" : "e.g. HQ Back Office"}
                value={locName}
                onChange={(e) => setLocName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loc-addr">Address</Label>
              <Input
                id="loc-addr"
                placeholder="e.g. 123 Commercial Belt, Sector 5"
                value={locAddress}
                onChange={(e) => setLocAddress(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="loc-pin">Map Pin / GPS</Label>
              <Input
                id="loc-pin"
                placeholder="e.g. https://maps.google.com/..."
                value={locMapPin}
                onChange={(e) => setLocMapPin(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAddLocation} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Save Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Location Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Location</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-1.5">
              <Label htmlFor="edit-loc-name">Location Name *</Label>
              <Input
                id="edit-loc-name"
                value={locName}
                onChange={(e) => setLocName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-loc-addr">Address</Label>
              <Input
                id="edit-loc-addr"
                value={locAddress}
                onChange={(e) => setLocAddress(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-loc-pin">Map Pin / GPS</Label>
              <Input
                id="edit-loc-pin"
                value={locMapPin}
                onChange={(e) => setLocMapPin(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleEditLocation} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Update Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
