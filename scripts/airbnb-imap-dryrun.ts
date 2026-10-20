/**
 * 카카오메일 IMAP 연결 + 에어비앤비 메일 파싱 dry-run. DB 에 저장하지 않는다.
 *
 *   node --env-file=.env.local scripts/airbnb-imap-dryrun.ts [days=7] [limit=20]
 *
 * 출력: 연결 성공 여부, 가져온 메일 수, 각 메일의 파싱 결과.
 */

import { fetchAirbnbMails } from "../src/lib/airbnb/mail/imap.ts";
import { parseAirbnbMail } from "../src/lib/airbnb/mail/parse.ts";

const days = Number(process.argv[2] ?? 7);
const limit = Number(process.argv[3] ?? 20);
const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

console.log(`IMAP ${process.env.KAKAO_IMAP_HOST ?? "imap.kakao.com"} 로 접속, ${since.toISOString().slice(0, 10)} 이후 airbnb 발신 메일 최대 ${limit}건`);

const started = Date.now();
const mails = await fetchAirbnbMails({ since, limit });
console.log(`연결 OK. ${mails.length}건 가져옴 (${Date.now() - started}ms)\n`);

for (const mail of mails) {
  const parsed = parseAirbnbMail(mail);
  console.log("=".repeat(70));
  console.log(`[${mail.date?.toISOString() ?? "?"}] ${mail.subject}`);
  console.log(`from: ${mail.from}  id: ${mail.messageId}`);
  console.log(`text 본문: ${mail.text ? mail.text.length + "자" : "없음"}, html: ${mail.html ? mail.html.length + "자" : "없음"}`);
  console.log(
    JSON.stringify(
      {
        isAirbnb: parsed.isAirbnb,
        kind: parsed.kind,
        guestName: parsed.guestName,
        listingName: parsed.listingName,
        threadId: parsed.threadId,
        threadUrl: parsed.threadUrl,
        reservationCode: parsed.reservationCode,
        checkIn: parsed.checkIn,
        checkOut: parsed.checkOut,
        messageText: parsed.messageText,
      },
      null,
      2
    )
  );
}
