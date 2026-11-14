import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import type { EnginePayload } from "@/lib/types";

function MountDeltaLine({ state }: { state: EnginePayload }) {
  const p = state.pointing;
  const nav = state.nav;
  if (!nav || !p.valid || nav.separation_deg === null) return null;
  if (nav.mount_right_deg === null || nav.mount_up_deg === null) {
    return (
      <div className="text-xs text-muted-foreground">
        Physical push guidance unavailable. Calibrate UP and RIGHT in setup.
      </div>
    );
  }
  const rightLabel = nav.mount_right_deg >= 0 ? "Right" : "Left";
  const upLabel = nav.mount_up_deg >= 0 ? "Up" : "Down";
  return (
    <div className="text-xs font-mono text-muted-foreground">
      Push scope: {rightLabel} {Math.abs(nav.mount_right_deg).toFixed(2)}°
      {" · "}{upLabel} {Math.abs(nav.mount_up_deg).toFixed(2)}°
      {" · "}Dist {nav.separation_deg.toFixed(2)}°
    </div>
  );
}

export function TrackingStep({ state }: { state: EnginePayload }) {
  const p = state.pointing;
  const nav = state.nav;
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Tracking</CardTitle>
          <Badge variant={state.sim_mode ? "secondary" : p.valid ? "default" : "destructive"}>
            {state.sim_mode ? "SIM" : p.valid ? "LOCK" : "LOST"}
          </Badge>
        </div>
        <CardDescription>
          {state.sim_mode
            ? `Simulated RA ${p.ra_deg.toFixed(2)}° / Dec ${p.dec_deg.toFixed(2)}°`
            : p.valid
              ? `RA ${p.ra_deg.toFixed(2)}° / Dec ${p.dec_deg.toFixed(2)}° / age ${(p.solve_age_s ?? 0).toFixed(1)}s`
              : "Acquiring stars…"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {nav?.active && (
          <div className="space-y-1">
            <div>
              Target: <strong>{nav.target_name ?? "N/A"}</strong>
              <Button variant="ghost" size="sm" onClick={() => api.clearGoto()} className="ml-2">
                Clear
              </Button>
            </div>
            <MountDeltaLine state={state} />
            <div className="text-[11px] text-muted-foreground">
              1° ~ 2 full moons wide
            </div>
          </div>
        )}
        {!state.sim_mode && (
          <Button variant="outline" onClick={() => api.wizardAdvance()}>
            Stop tracking and restart setup
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
