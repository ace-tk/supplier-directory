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
  Truck,
  UserSquare2,
  Pencil,
  ChevronDown,
  ChevronUp,
  Settings2,
  UserPlus,
  Check,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type SetupData, LocationType, nextCode, TOOLS, AccessRow, MemberEntityAssignmentRow } from "@/lib/business-structure";
import { saveBusinessSetupAction, type AssignedBusinessData } from "@/services/business-structure";

interface BusinessStructureTreeProps {
  saved: SetupData;
  assignedBusiness?: AssignedBusinessData;
  onSaved: (updated: SetupData) => void;
  onOpenTab: (tabId: "overview" | "setup" | "tables" | "hierarchy" | "portals" | "modules" | "flows" | "deals" | "roadmap") => void;
}

export function BusinessStructureTree({
  saved,
  assignedBusiness,
  onSaved,
  onOpenTab,
}: BusinessStructureTreeProps) {
  // Top Pool Bar Toggle
  const [showPool, setShowPool] = useState(true);

  // Add/Edit Location Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<LocationType>("WAREHOUSE");
  const [locName, setLocName] = useState("");
  const [locAddress, setLocAddress] = useState("");
  const [locMapPin, setLocMapPin] = useState("");
  const [saving, setSaving] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingLocCode, setEditingLocCode] = useState<string | null>(null);

  // Entity Assignment Modal for Team Member
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedMemberCode, setSelectedMemberCode] = useState<string | null>(null);

  // Member Tool Access Modal
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [selectedAccessAssignmentCode, setSelectedAccessAssignmentCode] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<string>("Content Management");
  const [toolView, setToolView] = useState(true);
  const [toolCreate, setToolCreate] = useState(false);
  const [toolEdit, setToolEdit] = useState(false);
  const [toolApprove, setToolApprove] = useState(false);

  // Defaults for Company 1
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

  const memberEntityAssignments = saved.memberEntityAssignments ?? [];

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

  // Toggle entity assignment for a team member
  const toggleMemberEntityAssignment = async (memberCode: string, entityType: "BUYER" | "SUPPLIER" | "FREELANCER", entityId: string, entityName: string) => {
    setSaving(true);
    const current = saved.memberEntityAssignments ?? [];
    const exists = current.some((a) => a.memberCode === memberCode && a.entityType === entityType && a.entityId === entityId);

    let updatedList: MemberEntityAssignmentRow[];
    if (exists) {
      updatedList = current.filter((a) => !(a.memberCode === memberCode && a.entityType === entityType && a.entityId === entityId));
    } else {
      updatedList = [...current, { memberCode, entityType, entityId, entityName }];
    }

    const updatedSetup: SetupData = {
      ...saved,
      memberEntityAssignments: updatedList,
    };

    const res = await saveBusinessSetupAction(updatedSetup);
    setSaving(false);

    if (res.success) {
      onSaved(res.data);
      toast.success(exists ? `Removed ${entityName} assignment` : `Assigned ${entityName} to member`);
    } else {
      toast.error(res.errors.join(", "));
    }
  };

  // Save specific tool access for assignment (e.g. Content Management access)
  const handleSaveToolAccess = async () => {
    if (!selectedAccessAssignmentCode) return;
    setSaving(true);

    const existingAccess = saved.access.filter((a) => a.assignmentCode !== selectedAccessAssignmentCode || a.tool !== selectedTool);
    const newAccessRow: AccessRow = {
      assignmentCode: selectedAccessAssignmentCode,
      tool: selectedTool,
      view: toolView,
      create: toolCreate,
      edit: toolEdit,
      approve: toolApprove,
    };

    const updatedAccess = [...existingAccess, newAccessRow];
    const updatedSetup: SetupData = {
      ...saved,
      access: updatedAccess,
    };

    const res = await saveBusinessSetupAction(updatedSetup);
    setSaving(false);

    if (res.success) {
      onSaved(res.data);
      setAccessModalOpen(false);
      toast.success(`Access updated for ${selectedTool}`);
    } else {
      toast.error(res.errors.join(", "));
    }
  };

  // Helpers to retrieve member assignments
  const getMemberAssignments = (memberCode: string) => {
    return memberEntityAssignments.filter((a) => a.memberCode === memberCode);
  };

  const getMemberAccessList = (memberCode: string) => {
    const memberAssignments = saved.assignments.filter((a) => a.memberCode === memberCode);
    const assignmentCodes = new Set(memberAssignments.map((a) => a.code));
    return saved.access.filter((acc) => assignmentCodes.has(acc.assignmentCode));
  };

  const selectedMember = saved.members.find((m) => m.code === selectedMemberCode);

  return (
    <div className="space-y-6">
      {/* TOP-LEVEL ADMIN POOL (COLLAPSIBLE HEADER BAR) */}
      <Card className="border-border bg-gradient-to-r from-background via-muted/20 to-background">
        <CardHeader className="p-4 sm:p-5 flex flex-row items-center justify-between cursor-pointer select-none" onClick={() => setShowPool(!showPool)}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold">MAIN ADMIN ENTITY POOL</CardTitle>
                <Badge variant="outline" className="text-xs bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
                  Global Pool
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Admin master directory: 50+ Buyers, Suppliers & Freelancers ready to be assigned to team members
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
            {showPool ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </Button>
        </CardHeader>

        {showPool && (
          <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 border-t border-border/60">
            <div className="grid gap-3 pt-4 sm:grid-cols-3 text-xs">
              {/* Buyers Pool */}
              <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 space-y-1">
                <div className="flex items-center justify-between font-semibold text-sky-800 dark:text-sky-200">
                  <span className="flex items-center gap-1.5"><UserSquare2 className="h-4 w-4" /> Buyers Pool</span>
                  <Badge variant="secondary" className="font-bold">{assignedBusiness?.buyers.length ?? 0}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">Available for admin to assign to sales & CRM team members</p>
              </div>

              {/* Suppliers Pool */}
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-1">
                <div className="flex items-center justify-between font-semibold text-emerald-800 dark:text-emerald-200">
                  <span className="flex items-center gap-1.5"><Truck className="h-4 w-4" /> Suppliers Pool</span>
                  <Badge variant="secondary" className="font-bold">{assignedBusiness?.suppliers.length ?? 0}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">Available for admin to assign to sourcing & procurement managers</p>
              </div>

              {/* Freelancers Pool */}
              <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 space-y-1">
                <div className="flex items-center justify-between font-semibold text-purple-800 dark:text-purple-200">
                  <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> Freelancers Pool</span>
                  <Badge variant="secondary" className="font-bold">{assignedBusiness?.freelancers.length ?? 0}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">Available for admin to assign to design & creative leads</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Visual Hierarchy Root Tree */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-xs">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight">BUSINESS STRUCTURE</h2>
            <p className="text-xs text-muted-foreground">Organizational hierarchy, team management, locations & assigned entities</p>
          </div>
        </div>

        {/* Tree Layout Container */}
        <div className="mt-6 space-y-8">
          {/* SECTION 1: TEAM MANAGEMENT */}
          <div className="relative pl-6 sm:pl-8 border-l-2 border-blue-500/30">
            <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-blue-500 ring-4 ring-background" />

            <div className="space-y-4">
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

              {/* Team Members List Card */}
              <Card className="bg-muted/30">
                <CardHeader className="p-3 sm:p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold">Team Members &amp; Assignments</CardTitle>
                      <CardDescription className="text-xs">
                        Configure team member roles, tool permissions (e.g. Content Management), and assigned Buyers/Suppliers/Freelancers
                      </CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => onOpenTab("tables")} className="text-xs font-medium text-primary">
                      Manage Setup Tables
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-0 space-y-3">
                  {saved.members.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No team members added yet. Add members in Setup Tables.</p>
                  )}

                  {saved.members.map((m) => {
                    const memberAssignments = saved.assignments.filter((a) => a.memberCode === m.code);
                    const assignedEntities = getMemberAssignments(m.code);
                    const memberAccess = getMemberAccessList(m.code);

                    return (
                      <div key={m.code} className="rounded-lg border border-border bg-background p-3.5 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/10 text-blue-600 font-bold text-xs">
                              {m.name[0]?.toUpperCase() ?? "M"}
                            </div>
                            <div>
                              <p className="font-semibold text-sm text-foreground">{m.name}</p>
                              <p className="text-[11px] text-muted-foreground">{m.code} {m.email ? `· ${m.email}` : ""}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => {
                                setSelectedMemberCode(m.code);
                                setAssignModalOpen(true);
                              }}
                            >
                              <UserPlus className="h-3 w-3" /> Assign Entities ({assignedEntities.length})
                            </Button>
                          </div>
                        </div>

                        {/* Designation & Location info */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {memberAssignments.map((a) => {
                            const b = saved.businesses.find((x) => x.code === a.businessCode);
                            const l = saved.locations.find((x) => x.code === a.locationCode);
                            return (
                              <Badge key={a.code} variant="secondary" className="text-[10px]">
                                {a.designation} {b ? `at ${b.name}` : ""} {l ? `(${l.name})` : ""}
                              </Badge>
                            );
                          })}

                          {/* Tool Access RBAC Summary */}
                          <div className="flex items-center gap-1.5 ml-auto">
                            <span className="text-[11px] font-medium text-muted-foreground">Tool Access:</span>
                            {memberAccess.length === 0 ? (
                              <span className="text-[11px] text-muted-foreground italic">None configured</span>
                            ) : (
                              memberAccess.map((acc) => (
                                <Badge key={acc.tool} variant="outline" className="text-[10px] bg-blue-50/50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800">
                                  {acc.tool} ({[acc.view && "V", acc.create && "C", acc.edit && "E", acc.approve && "A"].filter(Boolean).join("")})
                                </Badge>
                              ))
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1.5 text-[10px] text-primary"
                              onClick={() => {
                                const assignment = memberAssignments[0];
                                if (assignment) {
                                  setSelectedAccessAssignmentCode(assignment.code);
                                  setAccessModalOpen(true);
                                } else {
                                  toast.error("Member must have an assignment before setting tool access.");
                                }
                              }}
                            >
                              <Settings2 className="h-3 w-3 mr-0.5" /> Edit Access
                            </Button>
                          </div>
                        </div>

                        {/* Assigned Buyers, Suppliers, Freelancers tags */}
                        {assignedEntities.length > 0 && (
                          <div className="rounded-md bg-muted/40 p-2 space-y-1 text-xs">
                            <p className="text-[11px] font-semibold text-muted-foreground">Assigned Business Entities to {m.name}:</p>
                            <div className="flex flex-wrap gap-1">
                              {assignedEntities.map((ae) => (
                                <span key={`${ae.entityType}-${ae.entityId}`} className="inline-flex items-center gap-1 rounded bg-background border border-border px-1.5 py-0.5 text-[10px] font-medium">
                                  {ae.entityType === "BUYER" && <UserSquare2 className="h-3 w-3 text-sky-500" />}
                                  {ae.entityType === "SUPPLIER" && <Truck className="h-3 w-3 text-emerald-500" />}
                                  {ae.entityType === "FREELANCER" && <Users className="h-3 w-3 text-purple-500" />}
                                  <span>{ae.entityName}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
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
                      <CardTitle className="text-sm font-semibold">Assigned Business Summary</CardTitle>
                      <Badge variant="outline" className="text-[10px]">Buyers, Suppliers &amp; Freelancers</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="grid gap-3 sm:grid-cols-3 text-xs">

                      {/* Buyers */}
                      <div className="rounded-md border border-border bg-muted/20 p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between font-semibold">
                          <span className="flex items-center gap-1 text-sky-700 dark:text-sky-300">
                            <UserSquare2 className="h-3.5 w-3.5" /> Buyers ({assignedBusiness?.buyers.length ?? 0})
                          </span>
                        </div>
                        <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                          {assignedBusiness?.buyers.length === 0 && (
                            <p className="text-[10px] text-muted-foreground italic">No buyers linked</p>
                          )}
                          {assignedBusiness?.buyers.slice(0, 5).map((b) => (
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
                            <Truck className="h-3.5 w-3.5" /> Suppliers ({assignedBusiness?.suppliers.length ?? 0})
                          </span>
                        </div>
                        <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                          {assignedBusiness?.suppliers.length === 0 && (
                            <p className="text-[10px] text-muted-foreground italic">No suppliers linked</p>
                          )}
                          {assignedBusiness?.suppliers.slice(0, 5).map((s) => (
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
                            <Users className="h-3.5 w-3.5" /> Freelancers ({assignedBusiness?.freelancers.length ?? 0})
                          </span>
                        </div>
                        <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                          {assignedBusiness?.freelancers.length === 0 && (
                            <p className="text-[10px] text-muted-foreground italic">No freelancers linked</p>
                          )}
                          {assignedBusiness?.freelancers.slice(0, 5).map((f) => (
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

      {/* Assign Entities to Team Member Modal */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Assign Entities to {selectedMember?.name ?? "Team Member"}</DialogTitle>
            <DialogDescription className="text-xs">
              Select which Buyers, Suppliers, or Freelancers from the Admin Pool are assigned to this team member.
            </DialogDescription>
          </DialogHeader>

          {selectedMemberCode && (
            <div className="space-y-4 py-2 text-xs max-h-96 overflow-y-auto pr-1">
              {/* Assign Buyers */}
              <div className="space-y-2">
                <p className="font-semibold text-sky-700 dark:text-sky-300 flex items-center gap-1">
                  <UserSquare2 className="h-3.5 w-3.5" /> Buyers
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {assignedBusiness?.buyers.map((b) => {
                    const isAssigned = memberEntityAssignments.some(
                      (a) => a.memberCode === selectedMemberCode && a.entityType === "BUYER" && a.entityId === b.id
                    );
                    return (
                      <div
                        key={b.id}
                        onClick={() => toggleMemberEntityAssignment(selectedMemberCode, "BUYER", b.id, b.name)}
                        className={`flex items-center justify-between rounded-md border p-2 cursor-pointer transition-colors ${
                          isAssigned ? "border-sky-500 bg-sky-50 dark:bg-sky-950/40" : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <span className="font-medium truncate">{b.name}</span>
                        {isAssigned && <Check className="h-3.5 w-3.5 text-sky-600 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Assign Suppliers */}
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                  <Truck className="h-3.5 w-3.5" /> Suppliers
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {assignedBusiness?.suppliers.map((s) => {
                    const isAssigned = memberEntityAssignments.some(
                      (a) => a.memberCode === selectedMemberCode && a.entityType === "SUPPLIER" && a.entityId === s.id
                    );
                    return (
                      <div
                        key={s.id}
                        onClick={() => toggleMemberEntityAssignment(selectedMemberCode, "SUPPLIER", s.id, s.name)}
                        className={`flex items-center justify-between rounded-md border p-2 cursor-pointer transition-colors ${
                          isAssigned ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40" : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <span className="font-medium truncate">{s.name}</span>
                        {isAssigned && <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Assign Freelancers */}
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> Freelancers
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {assignedBusiness?.freelancers.map((f) => {
                    const isAssigned = memberEntityAssignments.some(
                      (a) => a.memberCode === selectedMemberCode && a.entityType === "FREELANCER" && a.entityId === f.id
                    );
                    return (
                      <div
                        key={f.id}
                        onClick={() => toggleMemberEntityAssignment(selectedMemberCode, "FREELANCER", f.id, f.name)}
                        className={`flex items-center justify-between rounded-md border p-2 cursor-pointer transition-colors ${
                          isAssigned ? "border-purple-500 bg-purple-50 dark:bg-purple-950/40" : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <span className="font-medium truncate">{f.name}</span>
                        {isAssigned && <Check className="h-3.5 w-3.5 text-purple-600 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button size="sm" onClick={() => setAssignModalOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member Tool Access Modal (RBAC, e.g. Content Management access) */}
      <Dialog open={accessModalOpen} onOpenChange={setAccessModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Configure Tool Access Permissions</DialogTitle>
            <DialogDescription className="text-xs">
              Grant specific tool permissions to this team member (e.g., Content Management, Marketing, CRM).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div className="space-y-1.5">
              <Label>Tool / Module</Label>
              <select
                value={selectedTool}
                onChange={(e) => setSelectedTool(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                {TOOLS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <Label className="text-xs font-semibold">Permissions Level</Label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 rounded-md border border-border p-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={toolView}
                    onChange={(e) => setToolView(e.target.checked)}
                    className="accent-primary"
                  />
                  <span>View</span>
                </label>
                <label className="flex items-center gap-2 rounded-md border border-border p-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={toolCreate}
                    onChange={(e) => setToolCreate(e.target.checked)}
                    className="accent-primary"
                  />
                  <span>Create</span>
                </label>
                <label className="flex items-center gap-2 rounded-md border border-border p-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={toolEdit}
                    onChange={(e) => setToolEdit(e.target.checked)}
                    className="accent-primary"
                  />
                  <span>Edit</span>
                </label>
                <label className="flex items-center gap-2 rounded-md border border-border p-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={toolApprove}
                    onChange={(e) => setToolApprove(e.target.checked)}
                    className="accent-primary"
                  />
                  <span>Approve</span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAccessModalOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSaveToolAccess} disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Save Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
