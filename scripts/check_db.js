import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bgqlhimtwuauigxxfbgq.supabase.co';
const supabaseAnonKey = 'sb_publishable_aqwu0gYWz0snGamP74Et6A_-dhN4CYS';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log("Attempting to create 'photos' bucket...");
  const { data, error } = await supabase.storage.createBucket('photos', { public: true });
  if (error) console.error("Error creating bucket:", error.message);
  else console.log("Bucket created:", data);
  
  console.log("Attempting to delete old local photos from DB...");
  const { data: delData, error: delError } = await supabase.from('photos').delete().like('url', '%localhost%');
  if (delError) console.error("Error deleting photos:", delError.message);
  else console.log("Deleted old photos successfully.");
}

check();
