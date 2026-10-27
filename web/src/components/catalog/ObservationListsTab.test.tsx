import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OBSERVATION_LISTS_KEY, readObservationState,
  type ObservationState,
} from "@/lib/observationLists";
import { ObservationListsTab } from "./ObservationListsTab";

vi.mock("@/lib/observationLists", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/observationLists")>()),
  resolveObservationTarget: (name: string) => name === "M31" || name === "M51"
    ? { source: "ngc", id: name } : null,
}));

function Harness() {
  const [value, setValue] = useState<ObservationState>(readObservationState);
  function save(next: ObservationState) {
    localStorage.setItem(OBSERVATION_LISTS_KEY, JSON.stringify(next));
    setValue(next);
    return true;
  }
  return <ObservationListsTab value={value} onChange={save} />;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("ObservationListsTab", () => {
  it("imports a list, tracks observations, selects the next target and restores progress", () => {
    const view = render(<Harness />);
    fireEvent.change(screen.getByLabelText("Paste observing lists"), {
      target: { value: "Galaxies: M31, M51" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import lists" }));
    expect(screen.getByText("0 / 2 observed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Observed M31" }));
    expect(screen.getByText("1 / 2 observed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next unobserved" }));
    expect(screen.getByRole("button", { name: "M51" })).toHaveAttribute("aria-current", "true");

    view.unmount();
    render(<Harness />);
    expect(screen.getByText("1 / 2 observed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "M51" })).toHaveAttribute("aria-current", "true");
  });

  it("keeps unmatched objects visible but not navigable", () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Paste observing lists"), {
      target: { value: "Unknown Object" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import lists" }));
    expect(screen.getByText("Not in catalog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next unobserved" })).toBeDisabled();
  });
});
