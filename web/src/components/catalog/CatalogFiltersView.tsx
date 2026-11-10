import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Equipment, LpTolerance, VisualReward } from "@/lib/catalogTypes";
import { EQUIPMENT, LP, REWARD } from "./catalogFilterOptions";
import type { CatalogFilterState } from "./catalogFilterOptions";


interface Props {
  value: CatalogFilterState;
  onChange: (next: CatalogFilterState) => void;
}

export function SelectedFiltersLine({ value }: { value: CatalogFilterState }) {
  const segs: { label: string; values: string }[] = [];
  if (value.equipment.size < EQUIPMENT.length) {
    segs.push({
      label: "Equipment",
      values: EQUIPMENT.filter((e) => value.equipment.has(e.value))
        .map((e) => e.label)
        .join(", "),
    });
  }
  if (value.lp.size < LP.length) {
    segs.push({
      label: "LP",
      values: LP.filter((l) => value.lp.has(l.value))
        .map((l) => l.label)
        .join(", "),
    });
  }
  if (value.reward.size < REWARD.length) {
    segs.push({
      label: "Reward",
      values: REWARD.filter((r) => value.reward.has(r.value))
        .map((r) => r.label)
        .join(", "),
    });
  }
  if (segs.length === 0) return null;
  return (
    <div className="text-xs text-muted-foreground">
      {segs.map((s, i) => (
        <span key={s.label}>
          {i > 0 && "  ·  "}
          <span className="font-semibold text-foreground">{s.label}:</span>{" "}
          {s.values}
        </span>
      ))}
    </div>
  );
}

export function CatalogFilters({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterDropdown
        label="Equipment"
        options={EQUIPMENT}
        selected={value.equipment as Set<string>}
        onChange={(next) => onChange({ ...value, equipment: next as Set<Equipment> })}
      />
      <FilterDropdown
        label="LP tolerance"
        options={LP}
        selected={value.lp as Set<string>}
        onChange={(next) => onChange({ ...value, lp: next as Set<LpTolerance> })}
      />
      <FilterDropdown
        label="Visual reward"
        options={REWARD}
        selected={value.reward as Set<string>}
        onChange={(next) => onChange({ ...value, reward: next as Set<VisualReward> })}
      />
    </div>
  );
}

function FilterDropdown<T extends string>({
  label, options, selected, onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const total = options.length;
  const count = selected.size;
  const summary = count === total ? "All" : `${count} of ${total}`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          {label}: {summary}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2 space-y-1">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 cursor-pointer text-sm py-1">
            <Checkbox
              checked={selected.has(o.value)}
              onCheckedChange={(checked) => {
                const next = new Set(selected);
                if (checked) next.add(o.value);
                else next.delete(o.value);
                onChange(next);
              }}
            />
            {o.label}
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}

