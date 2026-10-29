-- ==============================================================================
-- GroupBuying / PoolBuy India — Cloudflare D1 Additive Migration
-- Migration: 0009_canonical_25_launch_cities.sql
-- Enforces: Canonical 25 Solar Launch Cities in authoritative cities directory
-- Additive migration preserving all existing rows and indexes
-- ==============================================================================

INSERT OR IGNORE INTO cities (id, name, slug, state, is_active) VALUES
  ('city-delhi', 'Delhi', 'delhi', 'Delhi', 1),
  ('city-mumbai', 'Mumbai', 'mumbai', 'Maharashtra', 1),
  ('city-bengaluru', 'Bengaluru', 'bengaluru', 'Karnataka', 1),
  ('city-hyderabad', 'Hyderabad', 'hyderabad', 'Telangana', 1),
  ('city-chennai', 'Chennai', 'chennai', 'Tamil Nadu', 1),
  ('city-kolkata', 'Kolkata', 'kolkata', 'West Bengal', 1),
  ('city-pune', 'Pune', 'pune', 'Maharashtra', 1),
  ('city-ahmedabad', 'Ahmedabad', 'ahmedabad', 'Gujarat', 1),
  ('city-surat', 'Surat', 'surat', 'Gujarat', 1),
  ('city-jaipur', 'Jaipur', 'jaipur', 'Rajasthan', 1),
  ('city-lucknow', 'Lucknow', 'lucknow', 'Uttar Pradesh', 1),
  ('city-kanpur', 'Kanpur', 'kanpur', 'Uttar Pradesh', 1),
  ('city-nagpur', 'Nagpur', 'nagpur', 'Maharashtra', 1),
  ('city-indore', 'Indore', 'indore', 'Madhya Pradesh', 1),
  ('city-bhopal', 'Bhopal', 'bhopal', 'Madhya Pradesh', 1),
  ('city-patna', 'Patna', 'patna', 'Bihar', 1),
  ('city-vadodara', 'Vadodara', 'vadodara', 'Gujarat', 1),
  ('city-coimbatore', 'Coimbatore', 'coimbatore', 'Tamil Nadu', 1),
  ('city-kochi', 'Kochi', 'kochi', 'Kerala', 1),
  ('city-ludhiana', 'Ludhiana', 'ludhiana', 'Punjab', 1),
  ('city-chandigarh', 'Chandigarh', 'chandigarh', 'Chandigarh', 1),
  ('city-gurugram', 'Gurugram', 'gurugram', 'Haryana', 1),
  ('city-noida', 'Noida', 'noida', 'Uttar Pradesh', 1),
  ('city-visakhapatnam', 'Visakhapatnam', 'visakhapatnam', 'Andhra Pradesh', 1),
  ('city-bhubaneswar', 'Bhubaneswar', 'bhubaneswar', 'Odisha', 1);
