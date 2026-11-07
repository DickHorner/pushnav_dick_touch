import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { EnginePayload } from "@/lib/types";

const STEPS = [0.1, 1, 5];

export function SimulatorControls({ state }: { state: EnginePayload }) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  function move(deltaRa: number, deltaDec: number) {
    setError(null);
    api.dev.simMove(deltaRa, deltaDec).catch((e) => {
      setError(e instanceof Error ? e.message : String(e));
    });
  }

  const nav = state.nav;
  const p = state.pointing;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-primary">Simulator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-xs text-muted-foreground">
          Synthetic camera and pointing. No hardware or plate solving.
        </p>
        <div className="flex items-center gap-1">
          <span className="text-xs mr-auto">Move by</span>
          {STEPS.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={step === value ? "default" : "outline"}
              onClick={() => setStep(value)}
              aria-label={`Step ${value} degrees`}
            >
              {value}°
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1">
          <span />
          <Button size="sm" variant="outline" onClick={() => move(0, step)}>
            Dec +
          </Button>
          <span />
          <Button size="sm" variant="outline" onClick={() => move(-step, 0)}>
            RA −
          </Button>
          <span className="text-center self-center text-xs text-muted-foreground">J2000</span>
          <Button size="sm" variant="outline" onClick={() => move(step, 0)}>
            RA +
          </Button>
          <span />
          <Button size="sm" variant="outline" onClick={() => move(0, -step)}>
            Dec −
          </Button>
          <span />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          disabled={!nav?.active}
          onClick={() => {
            if (nav?.active) {
              move(
                ((nav.target_ra_deg - p.ra_deg + 540) % 360) - 180,
                nav.target_dec_deg - p.dec_deg,
              );
            }
          }}
        >
          Center on selected target
        </Button>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
