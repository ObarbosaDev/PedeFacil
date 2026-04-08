const env = import.meta.env;

const isEnabled = (rawValue: unknown, fallback = true) => {
  if (typeof rawValue !== "string") return fallback;
  const value = rawValue.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  return fallback;
};

export const featureFlags = {
  automations: isEnabled(env.VITE_FEATURE_AUTOMATIONS, true),
  marketplaceOps: isEnabled(env.VITE_FEATURE_MARKETPLACE_OPS, true),
  premiumSupport: isEnabled(env.VITE_FEATURE_PREMIUM_SUPPORT, true),
};

