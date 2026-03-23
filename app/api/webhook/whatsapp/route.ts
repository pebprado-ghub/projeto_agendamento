import { NextRequest, NextResponse } from "next/server";

type WhatsAppInboundPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          id?: string;
          from?: string;
          timestamp?: string;
          text?: { body?: string };
        }>;
      };
    }>;
  }>;
};

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as WhatsAppInboundPayload;

  // Placeholder: a validacao de assinatura e o roteamento real serao feitos no n8n.
  return NextResponse.json({
    received: true,
    firstMessage: payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0] ?? null
  });
}
