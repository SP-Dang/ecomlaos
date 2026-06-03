-- Add variant_price_adjustment column to cart_items
-- This stores the +/- price delta of the selected variant so that
-- cart and checkout pages always display the correct price.

ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS variant_price_adjustment integer NOT NULL DEFAULT 0;
