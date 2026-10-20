/**
 * 에어비앤비 게스트 메시지 메일(.eml)의 Reply-To 로 카카오 SMTP 회신을 보내는 수동 테스트.
 *
 *   node --env-file=.env.local scripts/airbnb-send-test.ts <원본.eml> "<보낼 본문>"
 *
 * 실제 게스트에게 메시지가 전달되므로 반드시 호스트가 본문을 확인한 뒤 실행한다.
 */

import { readFile } from "node:fs/promises";
import { parseRawMail } from "../src/lib/airbnb/mail/imap.ts";
import { parseAirbnbMail } from "../src/lib/airbnb/mail/parse.ts";
import { sendAirbnbReply } from "../src/lib/airbnb/mail/smtp.ts";

const [file, text] = process.argv.slice(2);
if (!file || !text) {
  console.error('사용법: node --env-file=.env.local scripts/airbnb-send-test.ts <원본.eml> "<본문>"');
  process.exit(1);
}

const mail = await parseRawMail(await readFile(file));
const parsed = parseAirbnbMail(mail);
console.log(`대상: ${parsed.guestName ?? "?"} / 스레드 ${parsed.threadId ?? "?"} / ${mail.subject.slice(0, 60)}`);
console.log(`회신 주소: ${mail.replyTo ?? "(없음)"}`);
if (!mail.replyTo) process.exit(2);

const { messageId } = await sendAirbnbReply({ to: mail.replyTo, subject: mail.subject, text, inReplyTo: mail.messageId });
console.log(`보냈습니다. SMTP message-id: ${messageId}`);
console.log("에어비앤비 호스트 메시지함에서 스레드에 올라갔는지 확인하세요 (몇 분 걸릴 수 있음).");
