import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { View } from "@/hooks/useView";
import App from "./App";

vi.mock("@/hooks/useEngineState", () => ({
  useEngineState: () => ({ dev_mode: false }),
}));
vi.mock("@/components/splash/Splash", () => ({ Splash: () => null }));
vi.mock("@/components/ErrorModal", () => ({ ErrorModal: () => null }));
vi.mock("@/components/StateHeader", () => ({
  StateHeader: ({ onViewChange }: { onViewChange: (view: View) => void }) => (
    <>
      <button onClick={() => onViewChange("catalog")}>Catalog</button>
      <button onClick={() => onViewChange("navigation")}>Navigation</button>
    </>
  ),
}));
vi.mock("@/components/live-view/LiveView", () => ({
  LiveView: () => <img src="/frame.mjpg" alt="Live camera frame" />,
}));
vi.mock("@/components/StepIndicator", () => ({ StepIndicator: () => null }));
vi.mock("@/components/wizard/Wizard", () => ({ Wizard: () => null }));
vi.mock("@/components/controls/CameraControls", () => ({ CameraControls: () => null }));
vi.mock("@/components/settings/Connectivity", () => ({ Connectivity: () => null }));
vi.mock("@/components/settings/Settings", () => ({ Settings: () => null }));
vi.mock("@/components/debug/DebugPanel", () => ({ DebugPanel: () => null }));
vi.mock("@/components/catalog/WhatToSee", () => ({
  WhatToSee: () => <div>Catalog content</div>,
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("App MJPEG stream lifecycle", () => {
  it("preserves the camera image through repeated catalog/navigation switches", () => {
    render(<App />);
    const frame = screen.getByAltText("Live camera frame");

    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Catalog" }));
      expect(screen.getByText("Catalog content")).toBeInTheDocument();
      expect(frame.isConnected).toBe(true);

      fireEvent.click(screen.getByRole("button", { name: "Navigation" }));
      expect(screen.getByAltText("Live camera frame")).toBe(frame);
    }
  });

  it("keeps the same camera image when the initial view is the catalog", () => {
    localStorage.setItem("pushnav.view", "catalog");
    render(<App />);
    const frame = screen.getByAltText("Live camera frame");

    fireEvent.click(screen.getByRole("button", { name: "Navigation" }));
    expect(screen.getByAltText("Live camera frame")).toBe(frame);
  });
});
