import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { EnginePayload } from "@/lib/types";

export function CalibrateStep({ state }: { state: EnginePayload }) {
  void state;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 3 — Calibrate</CardTitle>
        <CardDescription>
          Push the telescope UP (increase altitude) by at least 0.5° and hold
          steady. Calibration completes automatically once movement stabilises
          — this detects the camera's rotation relative to the mount.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" onClick={() => api.wizardAdvance()}>
          Skip calibration
        </Button>
      </CardContent>
    </Card>
  );
}
