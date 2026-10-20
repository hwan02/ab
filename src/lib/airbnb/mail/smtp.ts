/**
 * 에어비앤비 게스트 메시지에 메일로 회신한다.
 *
 * 에어비앤비는 게스트 메시지 알림 메일(express@airbnb.com)에 Reply-To: <코드>@reply.airbnb.com 을 넣어 준다.
 * 호스트 계정에 등록된 이메일 주소(= KAKAO_IMAP_USER)에서 그 주소로 회신하면 메시지가 스레드에 올라간다.
 * 그래서 보내는 주소는 반드시 수집에 쓰는 카카오메일 계정과 같아야 한다.
 *
 * 환경변수:
 *  KAKAO_IMAP_USER / KAKAO_IMAP_PASSWORD  (수집과 공유)
 *  KAKAO_SMTP_HOST  기본 smtp.kakao.com
 *  KAKAO_SMTP_PORT  기본 465 (SSL)
 */

import nodemailer from "nodemailer";

export interface ReplyInput {
  /** 원본 메일의 Reply-To (…@reply.airbnb.com) */
  to: string;
  /** 원본 메일 제목. "RE:" 가 없으면 붙인다. */
  subject: string;
  /** 평문 답장 본문 */
  text: string;
  /** 원본 Message-ID. 스레딩 헤더(In-Reply-To/References)에 넣는다. */
  inReplyTo?: string | null;
}

const REPLY_DOMAIN_RE = /@reply\.airbnb\.com$/i;

export function isAirbnbReplyAddress(address: string | null | undefined): address is string {
  return !!address && REPLY_DOMAIN_RE.test(address.trim());
}

export function smtpConfigFromEnv() {
  const user = process.env.KAKAO_IMAP_USER;
  const pass = process.env.KAKAO_IMAP_PASSWORD;
  if (!user || !pass) throw new Error("KAKAO_IMAP_USER / KAKAO_IMAP_PASSWORD 환경변수가 없습니다.");
  return {
    host: process.env.KAKAO_SMTP_HOST ?? "smtp.kakao.com",
    port: Number(process.env.KAKAO_SMTP_PORT ?? 465),
    secure: true,
    auth: { user, pass },
    from: user,
  };
}

export async function sendAirbnbReply(input: ReplyInput): Promise<{ messageId: string }> {
  if (!isAirbnbReplyAddress(input.to)) {
    throw new Error(`에어비앤비 회신 주소가 아닙니다: ${input.to}`);
  }
  const text = input.text.trim();
  if (!text) throw new Error("답장 본문이 비어 있습니다.");

  const cfg = smtpConfigFromEnv();
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.auth,
  });

  const subject = /^re:/i.test(input.subject.trim()) ? input.subject.trim() : `RE: ${input.subject.trim()}`;

  const info = await transporter.sendMail({
    from: cfg.from,
    to: input.to,
    subject,
    text,
    ...(input.inReplyTo ? { inReplyTo: input.inReplyTo, references: input.inReplyTo } : {}),
  });

  return { messageId: info.messageId };
}
