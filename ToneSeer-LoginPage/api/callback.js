import fetch from "node-fetch";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  const code = req.query.code;
  const state = req.query.state;

  if (!code) return res.status(400).send("No code received from Spotify.");
  if (!state) return res.status(400).send("No state returned from Spotify.");

  // Parse state once and get session_id + code_verifier
  let session_id, code_verifier;
  try {
    const stateObj = JSON.parse(decodeURIComponent(state));
    session_id = stateObj.session_id;
    code_verifier = stateObj.code_verifier;
  } catch (err) {
    console.error("Error parsing state:", err);
    return res.status(400).send("Invalid state format.");
  }

  if (!session_id) return res.status(400).send("No session_id found in state.");
  if (!code_verifier) return res.status(400).send("No code_verifier provided.");

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = "https://tone-seer-spotify-login.vercel.app/api/callback";

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: code_verifier
  });

  try {
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("Spotify token error:", tokenData);
      return res.status(500).send(`Failed to get token from Spotify: ${tokenData.error || "unknown error"}`);
    }

    const { error } = await supabase
      .from("spotify_tokens")
      .upsert({
        session_id: session_id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + tokenData.expires_in
      }, { onConflict: ["session_id"] });

    if (error) {
      console.error("Supabase upsert error:", error);
      return res.status(500).send("Error storing token.");
    }

    res.send("<h1>Spotify login successful! You can return to your TV.</h1>");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error exchanging code for token");
  }
}
