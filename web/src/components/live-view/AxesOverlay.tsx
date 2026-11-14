import type { EnginePayload } from "@/lib/types";

interface Props {
  state: EnginePayload;
}

/**
 * Physical mount axes through the sync-offset origin.
 * Calibration vectors are camera (right, up); SVG y increases downwards.
 */
export function AxesOverlay({ state }: Props) {
  if (!["CALIBRATE", "WARMING_UP", "TRACKING"].includes(state.state)) return null;
  if (!state.pointing.valid) return null;
  if (state.failures >= 3) return null;
  const axes = state.mount_axes;
  if (!axes) return null;

  const cx = state.origin_x;
  const cy = state.origin_y;
  const [upDx, upY] = axes.up;
  const [rightDx, rightY] = axes.right;
  const upDy = -upY;
  const rightDy = -rightY;

  const halfDiag = Math.sqrt(state.image_w ** 2 + state.image_h ** 2) / 2;
  const labelDist = 200;

  // Keep text aligned with each measured axis without turning it upside down.
  const readable = (deg: number): number => {
    const r = ((deg % 360) + 360) % 360;
    return r > 90 && r < 270 ? (r + 180) % 360 : r;
  };
  const upDownRot = readable(Math.atan2(upDy, upDx) * 180 / Math.PI);
  const leftRightRot = readable(Math.atan2(rightDy, rightDx) * 180 / Math.PI);
  const labels = [
    { text: "UP",    x: cx + upDx * labelDist,    y: cy + upDy * labelDist,    rot: upDownRot },
    { text: "DOWN",  x: cx - upDx * labelDist,    y: cy - upDy * labelDist,    rot: upDownRot },
    { text: "RIGHT", x: cx + rightDx * labelDist, y: cy + rightDy * labelDist, rot: leftRightRot },
    { text: "LEFT",  x: cx - rightDx * labelDist, y: cy - rightDy * labelDist, rot: leftRightRot },
  ];

  return (
    <g stroke="rgba(180, 35, 35, 0.95)" fill="rgba(255, 70, 70, 0.86)">
      {/* Mount-up and mount-right axes. */}
      <line
        x1={cx - upDx * halfDiag} y1={cy - upDy * halfDiag}
        x2={cx + upDx * halfDiag} y2={cy + upDy * halfDiag}
        strokeWidth={1}
      />
      <line
        x1={cx - rightDx * halfDiag} y1={cy - rightDy * halfDiag}
        x2={cx + rightDx * halfDiag} y2={cy + rightDy * halfDiag}
        strokeWidth={1}
      />
      {labels.map((l) => (
        <text
          key={l.text}
          x={l.x}
          y={l.y}
          transform={`rotate(${l.rot} ${l.x} ${l.y})`}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={24}
          fontWeight="bold"
        >
          {l.text}
        </text>
      ))}
    </g>
  );
}
