-- Tokens emitidos pela fundacao antiga eram armazenados em texto puro.
-- Invalidar os ativos antes de passar a persistir somente o digest SHA-256.
UPDATE app_refresh_tokens SET revoked_at = NOW() WHERE revoked_at IS NULL;
UPDATE email_verification_tokens SET used_at = NOW() WHERE used_at IS NULL;
UPDATE password_reset_tokens SET used_at = NOW() WHERE used_at IS NULL;
