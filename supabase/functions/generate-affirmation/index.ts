// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

// Execution Plan step 3.2 (FR-501, FR-504): goal -> AI-drafted affirmation
// text via Groq, with a per-user rate limit protecting the shared free-tier
// quota (ADR-0003, SYSTEM_DESIGN.md §5). Response contract matches
// SYSTEM_DESIGN.md §5 exactly: 200 { draftText }, 429 { error: "rate_limited" },
// 502 { error: "provider_unavailable" }. FR-502 (never auto-narrated) is
// enforced client-side -- this endpoint only ever returns plain draft text.

const GROQ_MODEL = "openai/gpt-oss-20b";
const RATE_LIMIT_WINDOW_HOURS = 24;
const RATE_LIMIT_MAX_REQUESTS = 20;

// Drafts are read aloud slowly by the on-device voices (step 3.13b), which pause 1.8 s after a
// sentence and 0.5 s at a comma or a " / " mark, so the prompt asks for short sentences and a
// pause or two marked inside them. Tuned against real Groq output: temperature 0.6 and the
// explicit grammar rule cut the awkward fragments seen at 0.8.
const SYSTEM_PROMPT = [
  "You write a short, positive sleep affirmation for the user's goal: first person, present tense,",
  "2-3 short, complete, natural-sounding sentences of about 4-9 words each. It will be read aloud",
  "slowly at bedtime by a calm voice, so it must read naturally and be grammatical.",
  "Pacing marks: you may use a comma where a calm speaker would naturally breathe, and add one or two",
  "short pauses inside a sentence with ' / ' (a slash with a space on each side) between two words",
  "that have no punctuation between them. Never put ' / ' next to a comma or period.",
  "Example of the style: I am deserving. My strength / is permanent. I am calm, safe / and at peace.",
  "Output only the affirmation text -- no quotes, no preamble, no markdown.",
].join(" ");

/**
 * Safety net for the model occasionally breaking its own pause-mark rules: drops a " / " next
 * to punctuation or at a line's start/end (redundant there), and normalizes the spacing.
 */
function tidyPauseMarks(text: string): string {
  return text
    .replace(/\s*\/\s*(?=[,.;:!?])/g, "")
    .replace(/([,.;:!?])\s*\/\s*/g, "$1 ")
    .replace(/^[ \t]*\/[ \t]*/gm, "")
    .replace(/[ \t]*\/[ \t]*$/gm, "")
    .replace(/[ \t]*\/[ \t]*/g, " / ")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const userId = ctx.userClaims!.id;

    let body: { goalId?: unknown; goalText?: unknown };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "invalid_request" }, { status: 400 });
    }

    const { goalId, goalText } = body;
    if (typeof goalText !== "string" || goalText.trim().length === 0) {
      return Response.json({ error: "invalid_request" }, { status: 400 });
    }
    if (typeof goalId !== "string" || goalId.trim().length === 0) {
      return Response.json({ error: "invalid_request" }, { status: 400 });
    }

    // Rate limit: count this user's requests in the trailing window using
    // the admin client (bypasses RLS -- this is server-side bookkeeping, not
    // client-readable/writable data). This pre-call check is what actually
    // protects the shared Groq quota; it runs before any provider call.
    const windowStart = new Date(
      Date.now() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000,
    ).toISOString();

    const { count, error: countError } = await ctx.supabaseAdmin
      .from("ai_generation_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", windowStart);

    if (countError) {
      console.error("ai_generation_log count failed:", countError.message);
      return Response.json({ error: "provider_unavailable" }, { status: 502 });
    }
    if ((count ?? 0) >= RATE_LIMIT_MAX_REQUESTS) {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }

    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) {
      console.error("GROQ_API_KEY is not configured");
      return Response.json({ error: "provider_unavailable" }, { status: 502 });
    }

    const userPrompt = `Goal: ${goalText}`;

    let draftText: string;
    try {
      const groqResponse = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${groqApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.6,
            max_tokens: 300,
            reasoning_effort: "low",
          }),
        },
      );

      if (!groqResponse.ok) {
        console.error("Groq request failed:", groqResponse.status, await groqResponse.text());
        return Response.json({ error: "provider_unavailable" }, { status: 502 });
      }

      const groqBody = await groqResponse.json();
      const content = groqBody?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || content.trim().length === 0) {
        console.error("Groq response had no usable content:", JSON.stringify(groqBody));
        return Response.json({ error: "provider_unavailable" }, { status: 502 });
      }
      draftText = tidyPauseMarks(content.trim());
    } catch (err) {
      console.error("Groq request threw:", err);
      return Response.json({ error: "provider_unavailable" }, { status: 502 });
    }

    // Log the request only on success -- a provider hiccup shouldn't cost the
    // user part of their daily quota. This doubles as SYSTEM_DESIGN.md §4's
    // documented ai_generation_log (the user's own history/debugging), so the
    // full prompt and result are kept, not just a bare counter. A logging
    // failure here is a bookkeeping problem, not a reason to withhold a draft
    // the user already paid a Groq call for, so it's reported but doesn't
    // change the response.
    const { error: insertError } = await ctx.supabaseAdmin
      .from("ai_generation_log")
      .insert({
        user_id: userId,
        goal_id: goalId,
        prompt_used: `${SYSTEM_PROMPT}\n\n${userPrompt}`,
        result_text: draftText,
      });
    if (insertError) {
      console.error("ai_generation_log insert failed:", insertError.message);
    }

    return Response.json({ draftText });
  }),
};

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Sign in via the app (or supabase-js) to get a user's access token
  3. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/generate-affirmation' \
    --header 'Authorization: Bearer <user-access-token>' \
    --header 'Content-Type: application/json' \
    --data '{"goalId":"<existing-goal-uuid>","goalText":"Run a half marathon by next spring"}'

*/
