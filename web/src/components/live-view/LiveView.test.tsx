import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EnginePayload } from "@/lib/types";
import { LiveView } from "./LiveView";

const base: EnginePayload = {
  state: "TRACKING", failures: 3,
  pointing: { valid: true, ra_deg: 0, dec_deg: 0, roll_deg: 0, matches: 10, prob: 0.01, solve_age_s: 0.5 },
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

describe("live plate-solve status", () => {
  it("retains the calibrated guide during a brief burst of rejected frames", () => {
    render(<LiveView state={base} showStars={false} />);
    expect(screen.queryByText(/NO PLATE SOLVE/)).not.toBeInTheDocument();
    expect(screen.getByText("UP")).toBeInTheDocument();
  });

  it("reports sustained loss and hides outdated directions", () => {
    render(<LiveView state={{ ...base, pointing: { ...base.pointing, solve_age_s: 2.1 } }} showStars={false} />);
    expect(screen.getByText(/NO PLATE SOLVE/)).toBeInTheDocument();
    expect(screen.queryByText("UP")).not.toBeInTheDocument();
  });

  it("reports repeated solve failures when no position was ever acquired", () => {
    render(<LiveView state={{ ...base, pointing: { ...base.pointing, valid: false, solve_age_s: null } }} showStars={false} />);
    expect(screen.getByText(/NO PLATE SOLVE/)).toBeInTheDocument();
  });
});
