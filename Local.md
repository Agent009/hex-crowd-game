To run Bolt Database locally, you need the Bolt Database CLI. Here's how:

1. Install Bolt Database CLI


npm install -g Bolt Database
2. Initialize Bolt Database in your project


Bolt Database init
3. Start local Bolt Database


Bolt Database start
This spins up local Docker containers for Postgres, Auth, Storage, etc. It will output local URLs and keys.

4. Update your .env to use local endpoints


VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<local-anon-key-from-Bolt Database-start-output>
5. Apply migrations to local database


Bolt Database db push
Prerequisites:

Docker Desktop must be installed and running
The supabase start command requires Docker
Useful commands:

supabase stop - Stop local containers
supabase db reset - Reset database and reapply migrations
supabase status - Show local service URLs and keys
The local Bolt Database Studio dashboard is available at http://localhost:54323 where you can browse your database, manage auth users, and more.