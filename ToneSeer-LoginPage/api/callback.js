import fetch from "node-fetch";
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  const code = req.query.code;
  let session_id = null;

  if (!code) {
    return res.status(400).send("No code received from Spotify.");
  }

  // 🔑 Extract session_id from state
  try {
    const state = req.query.state;
    if (state) {
      const parsed = JSON.parse(decodeURIComponent(state));
      session_id = parsed.session_id;
      code_verifier = parsed.code_verifier;
    }
  } catch (e) {
    console.error("Error parsing state:", e);
  }

  if (!session_id) {
    return res.status(400).send("No session_id found in state.");
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
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