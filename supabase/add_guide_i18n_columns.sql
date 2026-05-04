-- 1. Add i18n columns for checkin_guide, checkout_guide, house_rules
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS checkin_guide_en TEXT,
  ADD COLUMN IF NOT EXISTS checkin_guide_ja TEXT,
  ADD COLUMN IF NOT EXISTS checkin_guide_zh TEXT,
  ADD COLUMN IF NOT EXISTS checkout_guide_en TEXT,
  ADD COLUMN IF NOT EXISTS checkout_guide_ja TEXT,
  ADD COLUMN IF NOT EXISTS checkout_guide_zh TEXT,
  ADD COLUMN IF NOT EXISTS house_rules_en TEXT,
  ADD COLUMN IF NOT EXISTS house_rules_ja TEXT,
  ADD COLUMN IF NOT EXISTS house_rules_zh TEXT;

-- 2. Insert translation data
UPDATE properties
SET
  checkin_guide_en = $$11:00 AM

❤️Review Event❤️
Write a review and we'll extend your checkout by 1 hour until 11 AM 🤩

There are stairs leading up to the 2nd floor. Please be careful coming up!
4:00 PM$$,

  checkin_guide_ja = $$午前11時

❤️レビューイベント❤️
レビューを書いていただくと、チェックアウトを11時まで1時間延長いたします🤩

2階へ上がる階段がありますので、気をつけてお上がりください！
午後4時$$,

  checkin_guide_zh = $$上午11点

❤️评价活动❤️
撰写评价即可将退房时间延长1小时至上午11点 🤩

有通往2楼的楼梯，请小心上楼！
下午4点$$,

  checkout_guide_en = $$Please hold onto the railing when going down the stairs to avoid injury!$$,

  checkout_guide_ja = $$降りる際はケガをしないよう、必ず手すりを持って階段を降りてください！$$,

  checkout_guide_zh = $$下楼时请务必抓紧扶手，注意安全！$$,

  house_rules_en = $$‼️ Please do not flush toilet paper, sanitary pads, wet wipes, food waste, hair, slime, etc. into the toilet.
Repair costs will be charged if it gets clogged.

‼️ Additional compensation will be charged for stains that cannot be removed after washing / damage or theft of items.

🤫 The accommodation is located in a quiet residential area. Please be mindful of noise after 9 PM (21:00). 💤

🙏🏻 For the comfort of other guests, pets are not allowed.$$,

  house_rules_ja = $$‼️ トイレにトイレットペーパー、生理用品、ウェットティッシュ、食べ物、髪の毛、スライムなどを流さないでください。
詰まった場合、修理費用が請求されます。

‼️ 洗濯しても落ちないシミがある場合 / 備品の破損・盗難が発生した場合 / 別途弁償費用が発生します。

🤫 宿泊施設の周辺は住宅街に隣接しており静かです。夜9時（21時）以降の騒音にはご注意ください。💤

🙏🏻 他のお客様のため、ペットの同伴はご遠慮いただいております。$$,

  house_rules_zh = $$‼️ 请不要将卫生纸、卫生巾、湿巾、食物残渣、头发、史莱姆等丢入马桶。
堵塞时将收取维修费用。

‼️ 洗涤后无法去除的污渍 / 物品损坏或丢失 / 将收取额外赔偿费用。

🤫 住宿周围是安静的住宅区，请在晚上9点（21点）后注意控制噪音。💤

🙏🏻 为了其他客人的舒适，不允许携带宠物。$$

WHERE name ILIKE '%POPO%' OR name ILIKE '%포포%';
