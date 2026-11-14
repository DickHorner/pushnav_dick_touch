import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { EnginePayload } from "@/lib/types";

export function CalibrateStep({ state }: { state: EnginePayload }) {
  const right = state.calibration?.phase === "right";
  return (
    <Card>
      <CardHeader>
        <CardTitle>{right ? "Step 3b — Move RIGHT" : "Step 3a — Move UP"}</CardTitle>
        <CardDescription>
          {right
            ? "Now push the telescope to the RIGHT along its horizontal axis by at least 0.5° (do not change altitude). Hold still until PushNav confirms both mount directions."
            : "Push the telescope UP (increase altitude) by at least 0.5°, without turning it left or right. Hold steady until PushNav asks for the RIGHT movement."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {state.calibration?.error && (
          <p className="text-xs text-destructive" role="alert">
            {state.calibration.error}
          </p>
        )}
        <Button variant="outline" onClick={() => api.wizardAdvance()}>
          Skip (no physical push arrows)
        </Button>
      </CardContent>
    </Card>
  );
}
