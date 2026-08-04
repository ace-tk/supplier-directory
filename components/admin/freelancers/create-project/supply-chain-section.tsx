"use client";

import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Check, ChevronsUpDown, Workflow, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { getSupplyChainOptionsAction, type SupplyChainOption } from "@/services/projects";
import { cn } from "@/lib/utils";
import type { CreateProjectFormValues } from "@/lib/validations/project";

export function SupplyChainSection() {
  const { watch, setValue } = useFormContext<CreateProjectFormValues>();
  const supplyChainId = watch("supplyChainId");
  const [options, setOptions] = useState<SupplyChainOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getSupplyChainOptionsAction().then((result) => {
      if (result.success) setOptions(result.data);
      setLoading(false);
    });
  }, []);

  const selected = options.find((o) => o.id === supplyChainId);

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Optionally link this project to an existing Supply Chain. This only creates a reference — it does not change
        the Supply Chain itself.
      </p>
      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button variant="outline" className="w-full sm:w-80 justify-between font-normal" disabled={loading}>
                <span className="flex items-center gap-2 truncate">
                  <Workflow className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  {selected ? `${selected.name} — ${selected.orderNumber}` : loading ? "Loading..." : "Search supply chains..."}
                </span>
                <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </Button>
            }
          />
          <PopoverContent className="w-80 p-0" align="start">
            <Command>
              <CommandInput placeholder="Search by name or order number..." />
              <CommandList>
                <CommandEmpty>No supply chains found.</CommandEmpty>
                <CommandGroup>
                  {options.map((o) => (
                    <CommandItem
                      key={o.id}
                      value={`${o.name} ${o.orderNumber}`}
                      onSelect={() => {
                        setValue("supplyChainId", o.id, { shouldValidate: true });
                        setOpen(false);
                      }}
                    >
                      <Check className={cn("h-3.5 w-3.5", supplyChainId === o.id ? "opacity-100" : "opacity-0")} />
                      <div className="flex flex-col">
                        <span className="text-sm">{o.name}</span>
                        <span className="text-[10px] text-muted-foreground">{o.orderNumber}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {selected && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setValue("supplyChainId", "")}
            aria-label="Clear supply chain link"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
