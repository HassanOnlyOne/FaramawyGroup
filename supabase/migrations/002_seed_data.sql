-- Delete existing data
DELETE FROM pricing_tiers;
DELETE FROM products;
DELETE FROM categories;

-- Categories
INSERT INTO categories (id, name, sort_order, is_active) VALUES
('cat-oils', 'زيوت وسمن', 1, true),
('cat-rice', 'أرز ومكرونة', 2, true),
('cat-sugar', 'سكر وشاي', 3, true),
('cat-cleaning', 'منظفات', 4, true),
('cat-drinks', 'مشروبات', 5, true),
('cat-dairy', 'ألبان وأجبان', 6, true),
('cat-canned', 'معلبات', 7, true),
('cat-grocery', 'مستلزمات بقالة', 8, true)
ON CONFLICT (id) DO NOTHING;

-- Products
INSERT INTO products (id, name, sku, sku_code, category_id, unit, wholesale_unit, base_price, stock_quantity, min_order_quantity, images) VALUES
(gen_random_uuid(), 'زيت عافية 800 مل', '186', '186', 'cat-oils', 'زجاجة', 'كرتونة', 540, 100, 1, '[]'::jsonb),
(gen_random_uuid(), 'أرز أبو كاس 5 كيلو', '289', '289', 'cat-rice', 'شكارة', 'شكارة', 180, 100, 2, '[]'::jsonb),
(gen_random_uuid(), 'سكر القصب 1 كيلو', '301', '301', 'cat-sugar', 'كيس', 'شكارة', 320, 100, 1, '[]'::jsonb),
(gen_random_uuid(), 'شاي العروسة 250 جم', '315', '315', 'cat-sugar', 'عبوة', 'كرتونة', 720, 100, 1, '[]'::jsonb),
(gen_random_uuid(), 'صابون برسيل 3 كيلو', '401', '401', 'cat-cleaning', 'عبوة', 'كرتونة', 480, 100, 1, '[]'::jsonb),
(gen_random_uuid(), 'بيبسي 330 مل', '501', '501', 'cat-drinks', 'علبة', 'كرتونة', 216, 100, 1, '[]'::jsonb),
(gen_random_uuid(), 'جبنة فيتا استانبولي 500 جم', '601', '601', 'cat-dairy', 'عبوة', 'كرتونة', 360, 100, 1, '[]'::jsonb),
(gen_random_uuid(), 'فول حدائق كاليفورنيا 400 جم', '701', '701', 'cat-canned', 'علبة', 'كرتونة', 576, 100, 1, '[]'::jsonb),
(gen_random_uuid(), 'صلصة طماطم هاينز 320 جم', '702', '702', 'cat-canned', 'برطمان', 'كرتونة', 240, 100, 1, '[]'::jsonb),
(gen_random_uuid(), 'تونة دولفين قطع', '703', '703', 'cat-canned', 'علبة', 'كرتونة', 840, 100, 1, '[]'::jsonb),
(gen_random_uuid(), 'مكرونة حواء 400 جم', '290', '290', 'cat-rice', 'كيس', 'كرتونة', 180, 100, 1, '[]'::jsonb),
(gen_random_uuid(), 'سمنة روابي 1.5 كجم', '187', '187', 'cat-oils', 'علبة', 'كرتونة', 600, 100, 1, '[]'::jsonb),
(gen_random_uuid(), 'نسكافيه كلاسيك 200 جم', '316', '316', 'cat-sugar', 'برطمان', 'كرتونة', 1200, 50, 1, '[]'::jsonb),
(gen_random_uuid(), 'عصير جهينة برتقال 1 لتر', '502', '502', 'cat-drinks', 'علبة', 'كرتونة', 300, 100, 1, '[]'::jsonb),
(gen_random_uuid(), 'لبن لمار كامل الدسم 1 لتر', '602', '602', 'cat-dairy', 'علبة', 'كرتونة', 360, 100, 1, '[]'::jsonb),
(gen_random_uuid(), 'جبنة كيري 12 قطعة', '603', '603', 'cat-dairy', 'علبة', 'كرتونة', 540, 100, 1, '[]'::jsonb),
(gen_random_uuid(), 'مسحوق اريال اتوماتيك 2.5 كجم', '402', '402', 'cat-cleaning', 'كيس', 'كرتونة', 960, 100, 1, '[]'::jsonb),
(gen_random_uuid(), 'خل تفاح هاينز', '801', '801', 'cat-grocery', 'زجاجة', 'كرتونة', 240, 100, 1, '[]'::jsonb),
(gen_random_uuid(), 'ملح بونو', '802', '802', 'cat-grocery', 'كيس', 'لفة', 120, 100, 1, '[]'::jsonb),
(gen_random_uuid(), 'زيتون كلاماتا', '803', '803', 'cat-grocery', 'برطمان', 'كرتونة', 480, 100, 1, '[]'::jsonb)
ON CONFLICT DO NOTHING;

-- Pricing tiers
INSERT INTO pricing_tiers (id, product_id, min_quantity, max_quantity, price_per_unit)
SELECT gen_random_uuid(), id, 5, 19, base_price * 0.95 FROM products
ON CONFLICT DO NOTHING;

INSERT INTO pricing_tiers (id, product_id, min_quantity, max_quantity, price_per_unit)
SELECT gen_random_uuid(), id, 20, NULL, base_price * 0.90 FROM products
ON CONFLICT DO NOTHING;
