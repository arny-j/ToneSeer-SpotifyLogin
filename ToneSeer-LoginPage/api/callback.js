import fetch from "node-fetch";

export default async function handler(req, res) {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send("No code received from Spotify.");
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = "https://tone-seer-spotify-login.vercel.app/api/callback";

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret
  });

  try {
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });

    const tokenData = await tokenRes.json();

    // TODO: store tokenData in a DB or memory associated with a device ID
    console.log("Spotify token received:", tokenData);
    // Device ID must come from the index.html QR code or query param
   
    const device_id = req.query.device_id;
    if (!device_id) return res.status(400).send("No device ID provided.");

    const { error } = await supabase
      .from("spotify_tokens")
      .upsert({
        device_id: device_id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + tokenData.expires_in
      }, { onConflict: ["device_id"] });

    if (error) {
      console.error(error);
      return res.status(500).send("Error storing token.");
    }
    
    // Tell user login was successful
    res.send("<h1>Spotify login successful! You can return to your TV.</h1>");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error exchanging code for token");
  }
}
