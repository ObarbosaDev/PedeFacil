import { supabase } from "@/integrations/supabase/client";

const DEVICE_INSTALL_ID_KEY = "pedefacil.device.install_id";

export type SecuritySettings = {
  otp_enabled: boolean;
  require_step_up_for_critical_actions: boolean;
};

export type TrustedDevice = {
  id: string;
  user_id: string;
  device_fingerprint: string;
  device_label: string;
  trusted_at: string;
  last_used_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

const defaultSettings: SecuritySettings = {
  otp_enabled: false,
  require_step_up_for_critical_actions: true,
};

function isMissingRelationError(error: any) {
  if (!error) return false;
  const message = String(error.message || "").toLowerCase();
  const details = String(error.details || "").toLowerCase();
  const code = String(error.code || "").toLowerCase();
  return (
    code === "42p01" ||
    message.includes("could not find the table") ||
    message.includes("relation") ||
    details.includes("does not exist")
  );
}

function readOrCreateInstallId() {
  const existing = localStorage.getItem(DEVICE_INSTALL_ID_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(DEVICE_INSTALL_ID_KEY, created);
  return created;
}

async function sha256Hex(value: string) {
  if (!crypto?.subtle) return value;
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function getCurrentDeviceFingerprint() {
  const installId = readOrCreateInstallId();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
  const source = [installId, navigator.userAgent, navigator.language, timezone].join("|");
  return sha256Hex(source);
}

export function getCurrentDeviceLabel() {
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "Dispositivo";
  let browser = "Navegador";
  if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari")) browser = "Safari";
  return `${platform} - ${browser}`;
}

export async function getSecuritySettings(userId: string): Promise<SecuritySettings> {
  const { data, error } = await (supabase as any)
    .from("user_security_settings")
    .select("otp_enabled, require_step_up_for_critical_actions")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) return defaultSettings;
    throw error;
  }
  if (!data) return defaultSettings;
  return {
    otp_enabled: Boolean(data.otp_enabled),
    require_step_up_for_critical_actions: Boolean(data.require_step_up_for_critical_actions),
  };
}

export async function updateSecuritySettings(
  userId: string,
  patch: Partial<SecuritySettings>
): Promise<SecuritySettings> {
  const payload = {
    user_id: userId,
    ...patch,
  };

  const { data, error } = await (supabase as any)
    .from("user_security_settings")
    .upsert(payload, { onConflict: "user_id" })
    .select("otp_enabled, require_step_up_for_critical_actions")
    .single();

  if (error) {
    if (isMissingRelationError(error)) return { ...defaultSettings, ...patch };
    throw error;
  }

  return {
    otp_enabled: Boolean(data.otp_enabled),
    require_step_up_for_critical_actions: Boolean(data.require_step_up_for_critical_actions),
  };
}

function isDeviceActive(device: TrustedDevice) {
  if (device.revoked_at) return false;
  if (!device.expires_at) return true;
  return new Date(device.expires_at).getTime() > Date.now();
}

export async function isCurrentDeviceTrusted(userId: string) {
  const fingerprint = await getCurrentDeviceFingerprint();
  const { data, error } = await (supabase as any)
    .from("trusted_devices")
    .select("*")
    .eq("user_id", userId)
    .eq("device_fingerprint", fingerprint)
    .maybeSingle();

  if (error) {
    if (isMissingRelationError(error)) return false;
    throw error;
  }
  if (!data) return false;
  return isDeviceActive(data as TrustedDevice);
}

export async function trustCurrentDevice(userId: string, customLabel?: string) {
  const fingerprint = await getCurrentDeviceFingerprint();
  const { error } = await (supabase as any)
    .from("trusted_devices")
    .upsert(
      {
        user_id: userId,
        device_fingerprint: fingerprint,
        device_label: customLabel || getCurrentDeviceLabel(),
        trusted_at: new Date().toISOString(),
        last_used_at: new Date().toISOString(),
        revoked_at: null,
        user_agent: navigator.userAgent || null,
      },
      { onConflict: "user_id,device_fingerprint" }
    );

  if (error) {
    if (isMissingRelationError(error)) return;
    throw error;
  }
}

export async function touchCurrentTrustedDevice(userId: string) {
  const fingerprint = await getCurrentDeviceFingerprint();
  const { error } = await (supabase as any)
    .from("trusted_devices")
    .update({ last_used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("device_fingerprint", fingerprint)
    .is("revoked_at", null);
  if (error) {
    if (isMissingRelationError(error)) return;
    throw error;
  }
}

export async function listTrustedDevices(userId: string): Promise<TrustedDevice[]> {
  const { data, error } = await (supabase as any)
    .from("trusted_devices")
    .select("*")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("last_used_at", { ascending: false });
  if (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
  return (data || []) as TrustedDevice[];
}

export async function revokeTrustedDevice(userId: string, deviceId: string) {
  const { error } = await (supabase as any)
    .from("trusted_devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", deviceId);
  if (error) {
    if (isMissingRelationError(error)) return;
    throw error;
  }
}
