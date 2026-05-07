-- Fix address translations to include detailed address (building number)
UPDATE properties
SET
  address_en = '344-133 Yeonhui-dong, Seodaemun-gu, Seoul',
  address_ja = 'ソウル特別市 西大門区 延禧洞 344-133',
  address_zh = '首尔市 西大门区 延禧洞 344-133'
WHERE id = 'e6403715-882d-4b4d-a0d9-895fc35d0a9f';
