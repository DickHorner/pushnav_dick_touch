import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EnginePayload } from "@/lib/types";
import { AxesOverlay } from "./AxesOverlay";

const base: EnginePayload = {
  state: "TRACKING", failures: 0,
  pointing: { valid: true, ra_deg: 0, dec_deg: 0, roll_deg: 0, matches: 10, prob: 0.01, solve_age_s: 0 },
  nav: null,
  origin_x: 640, origin_y: 360, image_w: 1280, image_h: 720,
  finder_rotation: 0, mount_axes: { up: [0, 1], right: [-1, 0] }, fov_h_deg: 8.86,
  has_calibration: true, image_size: null,
  controls: [], sync: { in_progress: false, candidates: [], selected_idx: null, error: null },
  stellarium: { active: false, address: null }, lx200: { active: false, address: null },
  webserver: { url: null }, audio_enabled: true,
  camera: { connected: true, all_centroids: null, matched_centroids: null },
  location: { latitude: null, longitude: null, source: null },
  dev_mode: false, sim_mode: false, min_matches: 8, max_prob: 0.2, sample_active: null,
};

function renderAxes(state: EnginePayload) {
  render(<svg><AxesOverlay state={state} /></svg>);
}

describe("calibrated mount axes overlay", () => {
  it("shows UP at camera top and physical RIGHT at camera left when measured that way", () => {
    renderAxes(base);
    expect(screen.getByText("UP")).toHaveAttribute("x", "640");
    expect(screen.getByText("UP")).toHaveAttribute("y", "160");
    expect(screen.getByText("RIGHT")).toHaveAttribute("x", "440");
    expect(screen.getByText("RIGHT")).toHaveAttribute("y", "360");
    expect(screen.getByText("DOWN")).toHaveAttribute("y", "560");
    expect(screen.getByText("LEFT")).toHaveAttribute("x", "840");
  });

  it("uses rotated measured directions instead of the old finder rotation", () => {
    renderAxes({ ...base, mount_axes: { up: [1, 0], right: [0, 1] } });
    expect(screen.getByText("UP")).toHaveAttribute("x", "840");
    expect(screen.getByText("UP")).toHaveAttribute("y", "360");
    expect(screen.getByText("RIGHT")).toHaveAttribute("x", "640");
    expect(screen.getByText("RIGHT")).toHaveAttribute("y", "160");
  });

  it("does not invent axis labels without a complete calibration", () => {
    renderAxes({ ...base, mount_axes: null });
    expect(screen.queryByText("UP")).not.toBeInTheDocument();
    expect(screen.queryByText("RIGHT")).not.toBeInTheDocument();
  });
});
