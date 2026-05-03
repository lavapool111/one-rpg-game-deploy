-- Enable RLS on all tables
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "game_saves" ENABLE ROW LEVEL SECURITY;

-- 1. Policies for "users" table
-- Users can see their own profile
CREATE POLICY "Users can view their own profile" 
ON "users" FOR SELECT 
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile" 
ON "users" FOR UPDATE 
USING (auth.uid() = id);

-- 2. Policies for "scores" table
-- Users can see their own scores
CREATE POLICY "Users can view their own scores" 
ON "scores" FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own scores
CREATE POLICY "Users can insert their own scores" 
ON "scores" FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Everyone can view high scores (if we want a leaderboard)
CREATE POLICY "Public high scores viewing" 
ON "scores" FOR SELECT 
USING (true);

-- 3. Policies for "settings" table
-- Users can see their own settings
CREATE POLICY "Users can view their own settings" 
ON "settings" FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert/update their own settings
CREATE POLICY "Users can manage their own settings" 
ON "settings" FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Policies for "game_saves" table
-- Users can see their own saves
CREATE POLICY "Users can view their own saves" 
ON "game_saves" FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert/update their own saves
CREATE POLICY "Users can manage their own saves" 
ON "game_saves" FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
