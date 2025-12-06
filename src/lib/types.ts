import type { Context } from "hono";

export interface Env {
  KV: KVNamespace;
  DB: D1Database;
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_WEBHOOK_SECRET: string;
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
}

export interface RatingBody {
  rating: number;
  odid: string;
}

export interface RatingRow {
  theme_id: string;
  odid: string;
  rating: number;
  created_at: string;
  updated_at: string;
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
