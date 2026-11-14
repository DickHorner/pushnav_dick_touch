import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { EnginePayload } from "@/lib/types";
import { SOLAR_BODIES } from "@/lib/solarSystem";
import { WhatToSee } from "./WhatToSee";

const state = {
  location: { latitude: 52.5, longitude: 13.4, source: "manual" },
} as EnginePayload;

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("unified observing catalog", () => {
  it("finds Saturn without source tabs and sets its current position", async () => {
    const fetchMock = vi.fn(async (request: string, init?: RequestInit) => {
      if (request.startsWith("/api/solar-system?")) {
        return Response.json(SOLAR_BODIES.map((body) =>
          body.id === "saturn"
            ? { ...body, ra_deg: 100, dec_deg: 80, topocentric: true }
            : body,
        ));
      }
      if (request === "/api/bafk") return Response.json([]);
      if (request === "/api/goto/solar-system" && init?.method === "POST") {
        return new Response(null, { status: 204 });
      }
      return new Response("Not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    localStorage.setItem("pushnav.catalog.query", "Saturn");
    const onSwitchToNavigation = vi.fn();

    render(<WhatToSee state={state} onSwitchToNavigation={onSwitchToNavigation} />);

    expect(screen.getByRole("button", { name: "Suche" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Beobachtungslisten" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Advanced" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Sonnensystem Saturn/ }));
    expect(screen.getByText(/bewegliches Ziel/)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Set as target" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "Set as target" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/goto/solar-system",
        expect.objectContaining({ method: "POST" }),
      );
      expect(onSwitchToNavigation).toHaveBeenCalledOnce();
    });
  });
});
