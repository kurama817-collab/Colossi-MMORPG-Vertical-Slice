export function calculateWarmth(gain: number, cost: number): number {
  const epsilon = 0.0001; // small value to avoid division by zero
  const k = 0.1; // a constant offset for scaling
  
  return Math.log((gain + epsilon) / (cost + epsilon)) - k;
}
