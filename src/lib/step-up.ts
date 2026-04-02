const STEP_UP_PREFIX = "pedefacil.stepup";

type StepUpState = {
  verifiedAt: number;
};

function key(userId: string, purpose: string) {
  return `${STEP_UP_PREFIX}.${userId}.${purpose}`;
}

export function markStepUpVerified(userId: string, purpose: string) {
  const payload: StepUpState = { verifiedAt: Date.now() };
  localStorage.setItem(key(userId, purpose), JSON.stringify(payload));
}

export function hasRecentStepUp(userId: string, purpose: string, maxAgeMinutes = 10) {
  try {
    const raw = localStorage.getItem(key(userId, purpose));
    if (!raw) return false;
    const state = JSON.parse(raw) as StepUpState;
    if (!state?.verifiedAt) return false;
    return Date.now() - Number(state.verifiedAt) <= maxAgeMinutes * 60 * 1000;
  } catch {
    return false;
  }
}
