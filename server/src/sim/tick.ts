import { calculateWarmth } from "./metrics";

export interface Metrics {
  warmth: number;
  coherence: number;
  stability: number;
}

export interface OrganelleState {
  capacity: number;
  efficiency: number;
  utilization: number;
}

export interface PlayerAllocation {
  organelle: string;
  utilization: number;
}

export interface PlayerAction {
  playerId: string;
  allocations?: PlayerAllocation[];
  harmony?: number;
}

export interface ResourceFlows {
  energy: number;
  nutrients: number;
}

export type SimulationEventType = "anomaly" | "festival" | "repair";

export interface SimulationEvent {
  id: string;
  type: SimulationEventType;
  impact: {
    energy?: number;
    nutrients?: number;
    coherence?: number;
    stability?: number;
  };
}

export interface SimulationState {
  tick: number;
  tier: number;
  metrics: Metrics;
  resources: {
    energy: number;
    nutrients: number;
  };
  organelles: Record<string, OrganelleState>;
  strain: number;
  blah: number;
  pendingActions: PlayerAction[];
  activeEvents: SimulationEvent[];
}

export interface SimulationHooks {
  persist?: (state: SimulationState) => void;
  broadcast?: (state: SimulationState) => void;
}

const MIN_UTILIZATION = 0;
const MAX_UTILIZATION = 1;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function collectPlayerActions(state: SimulationState): PlayerAction[] {
  return state.pendingActions.slice();
}

function applyAllocations(state: SimulationState, actions: PlayerAction[]): void {
  for (const action of actions) {
    for (const allocation of action.allocations ?? []) {
      const organelle = state.organelles[allocation.organelle];
      if (!organelle) {
        continue;
      }
      organelle.utilization = clamp(
        organelle.utilization + allocation.utilization,
        MIN_UTILIZATION,
        MAX_UTILIZATION
      );
    }
  }
}

function computeResourceFlows(state: SimulationState): ResourceFlows {
  let energy = 0;
  let nutrients = 0;

  for (const organelle of Object.values(state.organelles)) {
    const output = organelle.capacity * organelle.efficiency * organelle.utilization;
    energy += output;
    nutrients -= output * 0.6;
  }

  return {
    energy,
    nutrients,
  };
}

function computeStrain(state: SimulationState, flows: ResourceFlows): number {
  const projectedNutrients = state.resources.nutrients + flows.nutrients;
  const nutrientDebt = Math.max(0, -projectedNutrients);
  const utilizationLoad = Object.values(state.organelles).reduce(
    (sum, organelle) => sum + organelle.utilization,
    0
  );

  return state.strain * 0.6 + nutrientDebt * 0.4 + utilizationLoad * 0.2;
}

function computeGainCost(flows: ResourceFlows, strain: number): { gain: number; cost: number } {
  const gain = Math.max(0, flows.energy);
  const cost = Math.max(0, -flows.nutrients) + strain * 0.5;

  return { gain, cost };
}

function computeCoherence(actions: PlayerAction[], events: SimulationEvent[]): number {
  const harmonyValues = actions.map((action) => action.harmony ?? 0);
  const averageHarmony = harmonyValues.length
    ? harmonyValues.reduce((sum, value) => sum + value, 0) / harmonyValues.length
    : 0;
  const eventBonus = events.reduce((sum, event) => sum + (event.impact.coherence ?? 0), 0);

  return clamp(averageHarmony + eventBonus, 0, 1);
}

function updateStability(state: SimulationState, strain: number, coherence: number): number {
  const base = state.metrics.stability;
  const next = base + coherence * 0.4 - strain * 0.3;

  return clamp(next, 0, 1);
}

function updateBlah(metrics: Metrics, current: number): number {
  const target = (metrics.warmth + metrics.stability + metrics.coherence) / 3;
  return current + (target - current) * 0.2;
}

function maybeSpawnEvents(state: SimulationState): SimulationEvent[] {
  const events: SimulationEvent[] = [];
  if (state.strain > 1.5) {
    events.push({
      id: `anomaly-${state.tick}`,
      type: "anomaly",
      impact: {
        stability: -0.2,
        energy: -2,
      },
    });
  }

  if (state.metrics.coherence > 0.7) {
    events.push({
      id: `festival-${state.tick}`,
      type: "festival",
      impact: {
        coherence: 0.1,
        energy: 1,
      },
    });
  }

  if (state.resources.nutrients < 1) {
    events.push({
      id: `repair-${state.tick}`,
      type: "repair",
      impact: {
        nutrients: 2,
        stability: 0.1,
      },
    });
  }

  return events;
}

function applyEvents(state: SimulationState, events: SimulationEvent[]): void {
  for (const event of events) {
    if (event.impact.energy) {
      state.resources.energy += event.impact.energy;
    }
    if (event.impact.nutrients) {
      state.resources.nutrients += event.impact.nutrients;
    }
    if (event.impact.coherence) {
      state.metrics.coherence = clamp(state.metrics.coherence + event.impact.coherence, 0, 1);
    }
    if (event.impact.stability) {
      state.metrics.stability = clamp(state.metrics.stability + event.impact.stability, 0, 1);
    }
  }

  state.activeEvents = events;
}

function maybeProgressTier(state: SimulationState): void {
  if (state.metrics.stability > 0.75 && state.metrics.warmth > 0.5) {
    state.tier += 1;
  }
}

function consumeFlows(state: SimulationState, flows: ResourceFlows): void {
  state.resources.energy += flows.energy;
  state.resources.nutrients += flows.nutrients;
  state.resources.energy = Math.max(0, state.resources.energy);
  state.resources.nutrients = Math.max(0, state.resources.nutrients);
}

export function tickSimulation(state: SimulationState, hooks: SimulationHooks = {}): SimulationState {
  const actions = collectPlayerActions(state);

  applyAllocations(state, actions);
  const flows = computeResourceFlows(state);
  const strain = computeStrain(state, flows);

  consumeFlows(state, flows);

  const { gain, cost } = computeGainCost(flows, strain);
  state.metrics.warmth = calculateWarmth(gain, cost);
  const events = maybeSpawnEvents(state);
  state.metrics.coherence = computeCoherence(actions, events);
  state.metrics.stability = updateStability(state, strain, state.metrics.coherence);

  state.strain = strain;
  state.blah = updateBlah(state.metrics, state.blah);

  applyEvents(state, events);
  maybeProgressTier(state);

  state.pendingActions = [];
  state.tick += 1;

  hooks.persist?.(state);
  hooks.broadcast?.(state);

  return state;
}
