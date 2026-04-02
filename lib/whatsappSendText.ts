export async function sendWhatsappTextMessage(
  to: string,
  body: string
): Promise<{ sent: true } | { sent: false; reason: string }> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) {
    return { sent: false as const, reason: "Credenciais do WhatsApp nao configuradas." };
  }
  const response = await fetch(
    `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/[^\d]/g, ""),
        type: "text",
        text: { body }
      })
    }
  );
  if (!response.ok) {
    return { sent: false as const, reason: "Falha ao enviar notificacao pelo WhatsApp." };
  }
  return { sent: true as const };
}
