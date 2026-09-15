/**
 * Advances a fixed-step simulation without retaining elapsed time before it starts.
 * Keeping the accumulator at zero while ready prevents a delayed start from
 * replaying all of the time the player spent on the start line.
 */
export function advanceSimulation(state, { accumulator, elapsed, interval, pendingInput = {} }, step) {
  if (state.mode !== 'running') {
    return { state, accumulator: 0, pendingInput };
  }

  let nextState = state;
  let nextAccumulator = accumulator + elapsed;
  let nextInput = pendingInput;
  while (nextAccumulator >= interval && nextState.mode === 'running') {
    nextState = step(nextState, nextInput);
    nextInput = {};
    nextAccumulator -= interval;
  }
  return { state: nextState, accumulator: nextAccumulator, pendingInput: nextInput };
}
