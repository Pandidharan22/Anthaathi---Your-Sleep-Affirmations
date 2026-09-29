/**
 * A voice reported by the device's on-device TTS engine. Android's Voice class has no gender
 * field, so `identifier`/`locale` are the only fields safe to build any curation on top of --
 * everything else here is exposed as-is for debugging/future use, not because it's reliable.
 */
export type AnthaathiVoice = {
  /** Opaque, stable-per-device identifier. Pass this back into `synthesizeToFile`. */
  identifier: string;
  /** BCP-47 language tag, e.g. "en-US". */
  locale: string;
  /** Android's Voice.QUALITY_* constant (higher is better; not comparable across engines). */
  quality: number;
  /** Android's Voice.LATENCY_* constant. */
  latency: number;
  isNetworkConnectionRequired: boolean;
  /** Raw, engine-specific feature flags -- not a stable or documented set. */
  features: string[];
};
