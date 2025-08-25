// /api/saveVerifier.js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key here
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const { session_id, code_verifier } = req.body;

  if (!session_id || !code_verifier) {
    return res.status(400).send("Missing session_id or code_verifier");
  }

  try {
    const { error } = await supabase
      .from("spotify_tokens")
      .upsert(
        { session_id, code_verifier },
        { onConflict: ["session_id"] }
      );

    if (error) {
      console.error("Supabase upsert error:", error);
      return res.status(500).send("Error storing code_verifier");
    }

    res.status(200).send("Verifier stored successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal server error");
  }
}