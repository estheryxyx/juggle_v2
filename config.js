// Juggle settings. Leave any of these empty to switch that feature off.
window.JUGGLE_CONFIG = {
  // Sign-in and sync across devices. From Supabase: Project Settings → API.
  // The anon key is designed to be public: row-level security in
  // supabase/schema.sql is what keeps each person's data private.
  supabaseUrl: "",
  supabaseAnonKey: "",

  // Google Calendar. From Google Cloud: APIs & Services → Credentials →
  // your OAuth client ID (type "Web application"). Also public by design:
  // Google only accepts it from the website addresses you list there.
  googleClientId: ""
};
