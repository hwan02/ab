/**
 * 실제 에어비앤비 알림 메일(.eml)을 파서에 넣어 결과를 본다.
 *
 *   node scripts/parse-airbnb-mail.ts path/to/mail.eml [more.eml ...]
 *
 * 카카오메일 웹에서 메일을 열고 "원본 보기" 또는 ".eml 저장" 으로 받은 파일을 넣으면 된다.
 * 파싱 결과가 틀리면 그 .eml 을 src/lib/airbnb/mail/__fixtures__/ 에 넣고 테스트를 추가한다.
 */

import { readFile } from "node:fs/promises";
import { parseRawMail } from "../src/lib/airbnb/mail/imap.ts";
import { parseAirbnbMail } from "../src/lib/airbnb/mail/parse.ts";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("사용법: node scripts/parse-airbnb-mail.ts <file.eml> [...]");
  process.exit(1);
}

for (const file of files) {
  const raw = await readFile(file);
  const mail = await parseRawMail(raw);
  const parsed = parseAirbnbMail(mail);
  console.log(`\n=== ${file} ===`);
  console.log(JSON.stringify({ messageId: mail.messageId, subject: mail.subject, from: mail.from, date: mail.date, ...parsed }, null, 2));
}
