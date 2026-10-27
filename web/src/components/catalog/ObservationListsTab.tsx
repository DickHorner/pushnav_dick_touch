import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  parseObservationLists, resolveObservationTarget,
  type ObservationList, type ObservationState,
} from "@/lib/observationLists";

interface Props {
  value: ObservationState;
  onChange: (next: ObservationState) => boolean;
}

export function ObservationListsTab({ value, onChange }: Props) {
  const { lists, activeListIndex } = value;
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const active = lists[activeListIndex] ?? null;
  const observed = active?.targets.filter((target) => target.done).length ?? 0;
  const hasNext = active?.targets.some(
    (target, index) => index !== active.selectedIndex
      && !target.done && resolveObservationTarget(target.name) !== null,
  ) ?? false;

  function save(next: ObservationState): boolean {
    if (!onChange(next)) {
      setError("Could not save lists in this browser.");
      return false;
    }
    setError(null);
    return true;
  }

  function updateActive(next: ObservationList) {
    save({
      ...value,
      lists: lists.map((list, index) => index === activeListIndex ? next : list),
    });
  }

  function importLists() {
    if (text.length > 20_000) {
      setError("Paste is too long (maximum 20,000 characters).");
      return;
    }
    const imported = parseObservationLists(text);
    if (imported.length === 0) {
      setError("No objects found in the pasted text.");
      return;
    }
    if (imported.reduce((count, list) => count + list.targets.length, 0) > 200) {
      setError("Import at most 200 objects at a time.");
      return;
    }
    if (lists.length + imported.length > 30) {
      setError("Keep at most 30 saved lists.");
      return;
    }
    if (save({ lists: [...lists, ...imported], activeListIndex: lists.length })) {
      setConfirmDelete(false);
      setText("");
    }
  }

  function selectTarget(index: number) {
    if (!active) return;
    updateActive({ ...active, selectedIndex: index });
  }

  function markObserved(index: number, done: boolean) {
    if (!active) return;
    updateActive({
      ...active,
      targets: active.targets.map((target, i) => i === index ? { ...target, done } : target),
    });
  }

  function nextTarget() {
    if (!active) return;
    for (let offset = 1; offset <= active.targets.length; offset++) {
      const index = (active.selectedIndex + offset) % active.targets.length;
      const target = active.targets[index];
      if (!target.done && resolveObservationTarget(target.name)) {
        selectTarget(index);
        return;
      }
    }
  }

  function deleteList() {
    if (!active) return;
    if (save({
      lists: lists.filter((_, index) => index !== activeListIndex),
      activeListIndex: Math.max(0, Math.min(activeListIndex, lists.length - 2)),
    })) setConfirmDelete(false);
  }

  return (
    <Card className="lg:col-span-2 flex flex-col gap-3 px-3 py-3 min-h-0 max-h-[70vh] lg:max-h-none">
      <details open={lists.length === 0} className="text-xs">
        <summary className="cursor-pointer text-foreground font-medium py-1">
          Paste / import observing lists
        </summary>
        <div className="flex flex-col gap-2 pt-2">
          <p className="text-muted-foreground">
            Paste catalog IDs separated by spaces or commas, or one object name per line.
            Use “Name:” to start a list and # for comments.
          </p>
          <textarea
            aria-label="Paste observing lists"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={5}
            placeholder={"Clusters: M3 M13 M92\nGalaxies: M31 (Andromeda), M51"}
            className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm text-foreground font-mono resize-y"
          />
          <Button size="sm" onClick={importLists} className="self-start">Import lists</Button>
        </div>
      </details>

      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">Lists and progress stay in this browser.</p>

      {active && (
        <>
          <div className="flex items-center gap-2">
            <select
              aria-label="Observation list"
              value={activeListIndex}
              onChange={(event) => {
                setConfirmDelete(false);
                save({ ...value, activeListIndex: Number(event.target.value) });
              }}
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
            >
              {lists.map((list, index) => (
                <option key={index} value={index}>{list.name}</option>
              ))}
            </select>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>Delete</Button>
          </div>
          {confirmDelete && (
            <div className="flex items-center gap-2 text-xs">
              <span>Delete {active.name}?</span>
              <Button size="sm" variant="destructive" onClick={deleteList}>Confirm</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{observed} / {active.targets.length} observed</span>
            <Button size="sm" variant="outline" disabled={!hasNext} onClick={nextTarget}>
              Next unobserved
            </Button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto pushnav-scrollbar">
            <ul className="flex flex-col gap-1">
              {active.targets.map((target, index) => {
                const found = resolveObservationTarget(target.name) !== null;
                return (
                  <li key={index} className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1",
                    active.selectedIndex === index && "bg-primary/15",
                  )}>
                    <Checkbox
                      checked={target.done}
                      onCheckedChange={(checked) => markObserved(index, checked === true)}
                      aria-label={"Observed " + target.name}
                    />
                    <button
                      type="button"
                      onClick={() => selectTarget(index)}
                      className="flex-1 min-w-0 text-left text-sm hover:text-primary"
                      aria-current={active.selectedIndex === index ? "true" : undefined}
                    >
                      <span className={cn(target.done && "line-through text-muted-foreground")}>{target.name}</span>
                      {target.note && <span className="ml-2 text-xs text-muted-foreground">{target.note}</span>}
                      {!found && <span className="ml-2 text-xs text-destructive">Not in catalog</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </Card>
  );
}
