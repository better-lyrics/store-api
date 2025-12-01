// Theme ID: alphanumeric + hyphens only
const THEME_ID_REGEX = /^[a-zA-Z0-9-]+$/;

// ODID: UUID format or 32-char hex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_32_REGEX = /^[0-9a-f]{32}$/i;

export function isValidThemeId(themeId: string): boolean {
  return (
    typeof themeId === "string" &&
    themeId.length > 0 &&
    themeId.length <= 100 &&
    THEME_ID_REGEX.test(themeId)
  );
}

export function isValidRating(rating: unknown): rating is number {
  return (
    typeof rating === "number" &&
    Number.isInteger(rating) &&
    rating >= 1 &&
    rating <= 5
  );
}

export function isValidOdid(odid: unknown): odid is string {
  return (
    typeof odid === "string" &&
    (UUID_REGEX.test(odid) || HEX_32_REGEX.test(odid))
  );
}

export interface ValidationError {
  field: string;
  message: string;
}

export function validateRatingBody(body: unknown): ValidationError | null {
  if (!body || typeof body !== "object") {
    return { field: "body", message: "Request body must be a JSON object" };
  }

  const { rating, odid } = body as { rating?: unknown; odid?: unknown };

  if (rating === undefined) {
    return { field: "rating", message: "Rating is required" };
  }

  if (!isValidRating(rating)) {
    return { field: "rating", message: "Rating must be an integer between 1 and 5" };
  }

  if (odid === undefined) {
    return { field: "odid", message: "ODID is required" };
  }

  if (!isValidOdid(odid)) {
    return {
      field: "odid",
      message: "ODID must be a valid UUID or 32-character hex string",
    };
  }

  return null;
}
