/**
 * 카카오메일 IMAP에서 에어비앤비 알림 메일을 가져온다.
 *
 * 전제:
 *  - 카카오메일 웹 > 환경설정 > IMAP/POP3 에서 "IMAP 사용"을 켜 둘 것
 *  - 카카오 계정에 2단계 인증이 켜져 있으면 앱 비밀번호를 발급해 KAKAO_IMAP_PASSWORD 에 넣을 것
 *
 * 환경변수:
 *  KAKAO_IMAP_USER      카카오메일 주소 (예: cohost@kakao.com)
 *  KAKAO_IMAP_PASSWORD  카카오메일 비밀번호 또는 앱 비밀번호
 *  KAKAO_IMAP_HOST      기본 imap.kakao.com
 *  KAKAO_IMAP_PORT      기본 993
 *
 * 설계 메모:
 *  - 읽음 처리로 중복을 막지 않는다. 사람이 메일함을 열어 읽어 버리면 놓치기 때문이다.
 *    대신 Message-ID 를 반환하고 저장 쪽(DB unique)에서 중복을 거른다.
 *  - 검색은 "최근 N일 + 보낸이 airbnb" 로 좁힌다. 동기화 주기가 5분이면 1일로 충분하다.
 */

import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";

export interface FetchedMail {
  messageId: string;
  uid: number;
  subject: string;
  from: string;
  date: Date | null;
  text: string | null;
  html: string | null;
}

export interface FetchOptions {
  /** 이 날짜 이후 메일만. 기본 1일 전. */
  since?: Date;
  /** 최대 개수. 기본 50. */
  limit?: number;
  /** 보낸이 필터. 기본 "airbnb". IMAP FROM 검색은 부분 일치. */
  fromContains?: string;
  mailbox?: string;
}

export function imapConfigFromEnv() {
  const user = process.env.KAKAO_IMAP_USER;
  const pass = process.env.KAKAO_IMAP_PASSWORD;
  if (!user || !pass) {
    throw new Error("KAKAO_IMAP_USER / KAKAO_IMAP_PASSWORD 환경변수가 없습니다.");
  }
  return {
    host: process.env.KAKAO_IMAP_HOST ?? "imap.kakao.com",
    port: Number(process.env.KAKAO_IMAP_PORT ?? 993),
    secure: true,
    auth: { user, pass },
    logger: false as const,
  };
}

export async function fetchAirbnbMails(opts: FetchOptions = {}): Promise<FetchedMail[]> {
  const since = opts.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const limit = opts.limit ?? 50;
  const fromContains = opts.fromContains ?? "airbnb";
  const mailbox = opts.mailbox ?? "INBOX";

  const client = new ImapFlow(imapConfigFromEnv());
  const results: FetchedMail[] = [];

  await client.connect();
  try {
    const lock = await client.getMailboxLock(mailbox);
    try {
      const uids = await client.search({ since, from: fromContains }, { uid: true });
      if (!uids || uids.length === 0) return results;

      // 최신 메일부터, limit 개만
      const picked = [...uids].sort((a, b) => b - a).slice(0, limit);

      for await (const msg of client.fetch(picked, { uid: true, source: true, envelope: true }, { uid: true })) {
        if (!msg.source) continue;
        const parsed = await simpleParser(msg.source);
        results.push(toFetchedMail(msg.uid, parsed));
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }

  return results;
}

/** 테스트와 CLI 에서 .eml 원문을 바로 넣을 때 쓴다. */
export async function parseRawMail(source: Buffer | string, uid = 0): Promise<FetchedMail> {
  const parsed = await simpleParser(source);
  return toFetchedMail(uid, parsed);
}

function toFetchedMail(uid: number, parsed: ParsedMail): FetchedMail {
  const fromText = parsed.from?.text ?? "";
  return {
    messageId: parsed.messageId ?? `uid:${uid}:${parsed.date?.getTime() ?? 0}`,
    uid,
    subject: parsed.subject ?? "",
    from: fromText,
    date: parsed.date ?? null,
    text: typeof parsed.text === "string" ? parsed.text : null,
    html: typeof parsed.html === "string" ? parsed.html : null,
  };
}
