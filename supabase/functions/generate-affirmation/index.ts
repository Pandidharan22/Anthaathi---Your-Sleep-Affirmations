// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

// Scaffold only (Execution Plan step 3.1) — the real goal -> draft-text call
// to the LLM provider (FR-501, FR-504) lands in step 3.2. This step proves:
//   - the function requires the caller's signed-in Supabase session (JWT),
//     matching SYSTEM_DESIGN.md §5's "Client -> Edge Function" contract
//   - the provider API key lives only in server-side env, and is never
//     echoed back to the client (only whether it's configured is reported)
export default {
  fetch: withSupabase({ auth: "user" }, async (_req, ctx) => {
    return Response.json({
      ready: Boolean(Deno.env.get("GROQ_API_KEY")),
      userId: ctx.userClaims!.id,
    });
  }),
};

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Sign in via the app (or supabase-js) to get a user's access token
  3. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/generate-affirmation' \
    --header 'Authorization: Bearer <user-access-token>' \
    --data '{}'

*/
