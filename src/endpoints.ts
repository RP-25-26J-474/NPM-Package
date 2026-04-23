const API_ENDPOINT_FALLBACK = "https://optimization-engine-ten.vercel.app/api";
const RL_ENDPOINT_FALLBACK = "https://rl-service.fly.dev";

function normalizeEndpoint(value: string): string {
  return value.replace(/\/+$/, "");
}

export const DEFAULT_AURA_API_ENDPOINT = normalizeEndpoint(
  process.env.AURA_API_ENDPOINT || API_ENDPOINT_FALLBACK
);

export const DEFAULT_AURA_RL_ENDPOINT = normalizeEndpoint(
  process.env.AURA_RL_ENDPOINT || process.env.AURA_RL_URL || RL_ENDPOINT_FALLBACK
);

export function resolveAuraApiEndpoint(override?: string): string {
  return normalizeEndpoint(override || DEFAULT_AURA_API_ENDPOINT);
}

export function resolveAuraRlEndpoint(override?: string): string {
  return normalizeEndpoint(override || DEFAULT_AURA_RL_ENDPOINT);
}
