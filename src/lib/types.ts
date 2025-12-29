import type { Context } from "hono";

export interface Env {
  KV: KVNamespace;
  DB: D1Database;
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_WEBHOOK_SECRET: string;
  GITHUB_ORG_INSTALLATION_ID: string;
  TURNSTILE_SITE_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  CERTIFICATE_SIGNING_KEY: string;
}

export type AppContext = Context<{ Bindings: Env }>;

export interface ThemeStats {
  installs: number;
  rating: number;
  ratingCount: number;
}

export interface StatsResponse {
  [themeId: string]: ThemeStats;
}

export interface RatingResponse {
  average: number;
  count: number;
}

export interface InstallResponse {
  count: number;
  alreadyCounted?: boolean;
}

export interface SignedRatingPayload {
  themeId: string;
  rating: number;
  timestamp: number;
  nonce: string;
  keyId: string;
}

export interface SignedRatingBody {
  payload: SignedRatingPayload;
  signature: string;
  publicKey?: JsonWebKey;
  turnstileToken?: string;
  certificate?: string;
}

export interface RatingResponseWithCertificate extends RatingStats {
  certificate?: string;
}

export interface SignedInstallPayload {
  themeId: string;
  timestamp: number;
  nonce: string;
  keyId: string;
}

export interface SignedInstallBody {
  payload: SignedInstallPayload;
  signature: string;
  publicKey?: JsonWebKey;
}

export interface PublicKeyRecord {
  key_id: string;
  public_key: string;
  display_name: string;
  created_at: string;
}

export interface RatingStats {
  average: number;
  count: number;
}

export interface RatingAggregateRow {
  theme_id: string;
  avg_rating: number;
  rating_count: number;
}

export interface ErrorResponse {
  error: string;
  message: string;
}

export interface ThemeMetadata {
  id: string;
  title: string;
  description?: string;
  creators: string[];
  version: string;
  minVersion?: string;
  hasShaders?: boolean;
  tags?: string[];
  images?: string[];
}

export interface WebhookPayload {
  repository: {
    full_name: string;
    owner: {
      login: string;
    };
  };
  ref: string;
  after: string;
  commits?: Array<{
    modified?: string[];
    added?: string[];
  }>;
  installation?: {
    id: number;
  };
}
