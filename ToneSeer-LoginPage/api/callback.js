import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // service role key
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  const { code, state } = req.query;

  if (!code) return res.status(400).send("No code received from Spotify.");
  if (!state) return res.status(400).send("No state returned from Spotify.");

  // session_id is passed in state
  const session_id = state;

  // Retrieve code_verifier from Supabase
  const { data, error: fetchError } = await supabase
    .from("spotify_tokens")
    .select("code_verifier")
    .eq("session_id", session_id)
    .single();

  if (fetchError || !data || !data.code_verifier) {
    console.error("Failed to retrieve code_verifier:", fetchError);
    return res.status(400).send("No code_verifier found for this session_id.");
  }

  const code_verifier = data.code_verifier;
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = "https://tone-seer-spotify-login.vercel.app/api/callback";

  try {
    // Exchange authorization code for tokens
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier
    });

    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("Spotify token error:", tokenData);
      return res.status(500).send(`Failed to get token: ${tokenData.error || "unknown"}`);
    }

    // Store tokens in Supabase
    const { error: upsertError } = await supabase
      .from("spotify_tokens")
      .upsert(
        {
          session_id,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: Math.floor(Date.now() / 1000) + tokenData.expires_in
        },
        { onConflict: ["session_id"] }
      );

    if (upsertError) {
      console.error("Supabase upsert error:", upsertError);
      return res.status(500).send("Error storing token.");
    }

    res.send("<h1>Spotify login successful! You can return to your TV.</h1>");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error exchanging code for token");
  }
}
