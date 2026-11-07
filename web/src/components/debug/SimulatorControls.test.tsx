import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SimulatorControls } from "./SimulatorControls";
import { api } from "@/lib/api";
import type { EnginePayload } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  api: { dev: { simMove: vi.fn().mockResolvedValue(undefined) } },
}));

const state: EnginePayload = {
  state: "TRACKING", failures: 0,
  pointing: { valid: true, ra_deg: 79, dec_deg: 46, roll_deg: 0, matches: 0, prob: 0, solve_age_s: 0 },
  nav: { active: true, target_name: "Target", target_ra_deg: 81, target_dec_deg: 45,
    separation_deg: 2, direction_text: "", in_fov: false, pixel_x: null, pixel_y: null,
    camera_angle_deg: null, edge_x: null, edge_y: null, edge_angle_deg: null },
  origin_x: 640, origin_y: 360, image_w: 1280, image_h: 720,
  finder_rotation: 0, fov_h_deg: 8.86,
  has_calibration: false, image_size: null,
  controls: [], sync: { in_progress: false, candidates: [], selected_idx: null, error: null },
  stellarium: { active: false, address: null }, lx200: { active: false, address: null },
  webserver: { url: null }, audio_enabled: false,
  camera: { connected: true, all_centroids: null, matched_centroids: null },
  location: { latitude: null, longitude: null, source: null },
  dev_mode: true, sim_mode: true, min_matches: 8, max_prob: 0.2, sample_active: null,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SimulatorControls", () => {
  it("sends relative moves using the selected step", () => {
    render(<SimulatorControls state={state} />);
    fireEvent.click(screen.getByRole("button", { name: "Step 5 degrees" }));
    fireEvent.click(screen.getByRole("button", { name: "RA +" }));
    expect(api.dev.simMove).toHaveBeenCalledWith(5, 0);
    fireEvent.click(screen.getByRole("button", { name: "Dec −" }));
    expect(api.dev.simMove).toHaveBeenCalledWith(0, -5);
  });

  it("centers on a selected target", () => {
    render(<SimulatorControls state={state} />);
    fireEvent.click(screen.getByRole("button", { name: "Center on selected target" }));
    expect(api.dev.simMove).toHaveBeenCalledWith(2, -1);
  });

  it("disables target centering when no target is selected", () => {
    render(<SimulatorControls state={{ ...state, nav: null }} />);
    expect(screen.getByRole("button", { name: "Center on selected target" })).toBeDisabled();
  });
});
