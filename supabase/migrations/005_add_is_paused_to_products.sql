-- Add is_paused to products table for pausing orders on specific items
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT false;
