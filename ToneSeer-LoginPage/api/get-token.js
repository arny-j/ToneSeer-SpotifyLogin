import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // needs service role for full access
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  const deviceId = req.query.device_id;
  if (!deviceId) {
    return res.status(400).json({ error: 'No device_id provided' });
  }

  // Query the Supabase table for the token
  const { data, error } = await supabase
    .from('spotify_tokens')
    .select('*')
    .eq('device_id', deviceId)
    .single();

  if (error) {
    return res.status(404).json({ error: 'Token not found' });
  }

  // Optionally check expiry here

  return res.status(200).json({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at
  });
}
