-- ==============================================================================
-- POOLBUY INDIA — MIGRATION 20261026000006: BLOG CMS
-- Implements Phase H Authoritative Requirements:
-- 1. blog_posts table with draft/published/archived lifecycle
-- 2. Indexes for slug lookup and published chronological queries
-- 3. public_blog_posts view for non-admin queries
-- 4. Row Level Security policies
-- ==============================================================================

CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  content TEXT NOT NULL,
  author TEXT NOT NULL,
  topic TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  cover_image_url TEXT,
  cover_image_alt TEXT,
  meta_title TEXT,
  meta_description TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sources TEXT[] DEFAULT '{}',
  editorial_notes TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(status, published_at DESC) WHERE status = 'PUBLISHED';
CREATE INDEX IF NOT EXISTS idx_blog_posts_topic ON blog_posts(topic);

-- Public View for Published Articles
CREATE OR REPLACE VIEW public_blog_posts AS
SELECT 
  id,
  slug,
  title,
  excerpt,
  content,
  author,
  topic,
  tags,
  cover_image_url,
  cover_image_alt,
  meta_title,
  meta_description,
  status,
  published_at,
  created_at,
  updated_at,
  sources
FROM blog_posts
WHERE status = 'PUBLISHED';

-- Enable RLS
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Allow public read of published posts
CREATE POLICY "Public can view published blog posts"
  ON blog_posts
  FOR SELECT
  TO anon, authenticated
  USING (status = 'PUBLISHED');

-- Allow service role full management
CREATE POLICY "Service role full access on blog posts"
  ON blog_posts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
