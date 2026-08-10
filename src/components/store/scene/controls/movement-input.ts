/** Shared, mutable (non-React) input state written by DesktopControls/MobileControls and read by PlayerRig every frame. */
export interface MovementInputState {
  forward: number; // -1..1
  strafe: number; // -1..1
  yawDelta: number; // accumulated look input since last frame, radians
  pitchDelta: number;
  moveTarget: [number, number] | null; // world-space x,z to walk toward (tap/click-to-move)
}

export function createMovementInput(): MovementInputState {
  return {
    forward: 0,
    strafe: 0,
    yawDelta: 0,
    pitchDelta: 0,
    moveTarget: null,
  };
}
