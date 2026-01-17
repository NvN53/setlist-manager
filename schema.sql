-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create songs table
CREATE TABLE songs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    key TEXT,
    bpm INT4 DEFAULT 120,
    lyrics TEXT,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create setlists table
CREATE TABLE setlists (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create setlist_songs table
CREATE TABLE setlist_songs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    setlist_id UUID REFERENCES setlists(id) ON DELETE CASCADE,
    song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
    position INT,
    UNIQUE(setlist_id, position)
);

-- Create user_setlists table
CREATE TABLE user_setlists (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    source_setlist_id UUID REFERENCES setlists(id),
    title TEXT,
    transpose INT DEFAULT 0,
    bpm_override INT,
    autoscroll_speed INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_setlist_songs table
CREATE TABLE user_setlist_songs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_setlist_id UUID REFERENCES user_setlists(id) ON DELETE CASCADE,
    song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
    position INT,
    UNIQUE(user_setlist_id, position)
);

-- Enable Row Level Security
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE setlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE setlist_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_setlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_setlist_songs ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies

-- Songs policies
CREATE POLICY "Songs are publicly readable" ON songs FOR SELECT USING (true);
CREATE POLICY "Users can insert songs" ON songs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own songs" ON songs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own songs" ON songs FOR DELETE USING (auth.uid() = user_id);

-- Setlists policies
CREATE POLICY "Setlists are publicly readable" ON setlists FOR SELECT USING (true);
CREATE POLICY "Users can insert setlists" ON setlists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own setlists" ON setlists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own setlists" ON setlists FOR DELETE USING (auth.uid() = user_id);

-- Setlist_songs policies
CREATE POLICY "Setlist songs are publicly readable" ON setlist_songs FOR SELECT USING (true);
CREATE POLICY "Only setlist creator can manage songs" ON setlist_songs FOR ALL USING (
    auth.uid() = (SELECT user_id FROM setlists WHERE id = setlist_id)
);

-- User_setlists policies
CREATE POLICY "Users can access own user setlists" ON user_setlists FOR ALL USING (auth.uid() = user_id);

-- User_setlist_songs policies
CREATE POLICY "Users can access own user setlist songs" ON user_setlist_songs FOR ALL USING (auth.uid() = (
    SELECT user_id FROM user_setlists WHERE id = user_setlist_id
));