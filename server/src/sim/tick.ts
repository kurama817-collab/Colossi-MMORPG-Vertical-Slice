tick(state):
  actions = collectPlayerActions()

  applyAllocations(state, actions)              // utilization per organelle
  flows = computeResourceFlows(state)           // +energy, -nutrients, etc.
  strain = computeStrain(state, flows)          // missing inputs => strain++

  {G, C} = computeGainCost(state, flows, strain)
  state.metrics.warmth = log((G+e)/(C+e)) - k
  state.metrics.coherence = computeCoherence(actions, events)
  state.metrics.stability = updateStability(state, strain, coherence)

  state.blah = updateBlah(state.metrics, state.blah)
  events = maybeSpawnEvents(state)              // anomalies, festivals, repairs

  state = applyEvents(state, events)
  state = maybeProgressTier(state)

  state.tick++
  persist(state)
  broadcast(state)
