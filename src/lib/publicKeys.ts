import type { PublicKeyRecord } from "./types";

const ADJECTIVES = [
  "Melodic", "Harmonic", "Acoustic", "Electric", "Mellow", "Groovy", "Funky", "Vibrant",
  "Golden", "Crystal", "Velvet", "Cosmic", "Stellar", "Radiant", "Mystic", "Serene",
  "Dynamic", "Smooth", "Crisp", "Warm", "Bright", "Deep", "Swift", "Bold",
  "Noble", "Grand", "Royal", "Epic", "Vivid", "Lucid", "Prime", "Pure",
  "Sonic", "Hyper", "Ultra", "Mega", "Super", "Astral", "Lunar", "Solar",
  "Neon", "Retro", "Classic", "Modern", "Fusion", "Primal", "Zen", "Nova",
  "Alpha", "Omega", "Delta", "Sigma", "Quantum", "Atomic", "Cyber", "Digital",
  "Analog", "Stereo", "Studio", "Live", "Remix", "Master", "Platinum", "Diamond"
];

const NOUNS = [
  "Bass", "Guitar", "Piano", "Drum", "Synth", "Chord", "Beat", "Riff",
  "Note", "Tempo", "Rhythm", "Melody", "Verse", "Chorus", "Bridge", "Hook",
  "Track", "Vinyl", "Record", "Album", "Mix", "Tape", "Loop", "Sample",
  "Treble", "Octave", "Scale", "Arpeggio", "Cadence", "Motif", "Theme", "Score",
  "Cymbal", "Snare", "Kick", "Hihat", "Conga", "Bongo", "Shaker", "Gong",
  "Violin", "Cello", "Flute", "Horn", "Trumpet", "Sax", "Harp", "Bell",
  "Staccato", "Legato", "Crescendo", "Fermata", "Vibrato", "Tremolo", "Glissando", "Sforzando",
  "Forte", "Allegro", "Adagio", "Presto", "Andante", "Largo", "Vivace", "Maestro"
];

const ACTIONS = [
  "Solo", "Remix", "Groove", "Flow", "Vibe", "Echo", "Pulse", "Drift",
  "Wave", "Loop", "Drop", "Rise", "Fade", "Blend", "Sync", "Glide",
  "Swing", "Bounce", "Slide", "Roll", "Spin", "Twist", "Shake", "Break",
  "Jam", "Play", "Rock", "Pop", "Jazz", "Funk", "Soul", "Blues",
  "Surge", "Rush", "Dash", "Zoom", "Flash", "Spark", "Blast", "Burst",
  "Chill", "Cruise", "Coast", "Sway", "Float", "Hover", "Soar", "Leap",
  "Strike", "Stomp", "Clap", "Snap", "Tap", "Slap", "Pluck", "Strum",
  "Hum", "Sing", "Chant", "Call", "Shout", "Whisper", "Croon", "Belt"
];

export async function getPublicKey(
  db: D1Database,
  keyId: string
): Promise<PublicKeyRecord | null> {
  return await db
    .prepare("SELECT * FROM public_keys WHERE key_id = ?")
    .bind(keyId.toLowerCase())
    .first<PublicKeyRecord>();
}

export async function registerPublicKey(
  db: D1Database,
  keyId: string,
  publicKeyJwk: JsonWebKey
): Promise<PublicKeyRecord> {
  const normalizedKeyId = keyId.toLowerCase();
  const displayName = generateDisplayName(normalizedKeyId);
  const publicKeyJson = JSON.stringify(publicKeyJwk);

  await db
    .prepare(
      "INSERT INTO public_keys (key_id, public_key, display_name) VALUES (?, ?, ?)"
    )
    .bind(normalizedKeyId, publicKeyJson, displayName)
    .run();

  return {
    key_id: normalizedKeyId,
    public_key: publicKeyJson,
    display_name: displayName,
    created_at: new Date().toISOString()
  };
}

export function generateDisplayName(keyId: string): string {
  const hex = keyId.toLowerCase().replace(/[^0-9a-f]/g, "");
  const adjIndex = parseInt(hex.slice(0, 2), 16) % ADJECTIVES.length;
  const nounIndex = parseInt(hex.slice(2, 4), 16) % NOUNS.length;
  const actionIndex = parseInt(hex.slice(4, 6), 16) % ACTIONS.length;

  return `${ADJECTIVES[adjIndex]}${NOUNS[nounIndex]}${ACTIONS[actionIndex]}`;
}
