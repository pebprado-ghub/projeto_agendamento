# Nome do cliente no WhatsApp vs agenda do telefone

## O que a API do WhatsApp (Meta) envia

Na **WhatsApp Cloud API**, cada mensagem pode vir acompanhada de `contacts[].profile.name`: é o **nome público do perfil** daquele número no WhatsApp (o que a pessoa configurou no aplicativo).

- **Não existe** na API um campo com o nome que o **administrador salvou na agenda** do celular. Esse dado fica só no aparelho e a Meta não expõe para integrações.

## O que o projeto faz

1. O workflow **`01_whatsapp_inbound_router`** extrai `contacts[0].profile.name` e expõe como `whatsapp_profile_name` na resposta do webhook.
2. Quem chamar o **`03_internal_booking_orchestrator`** deve repassar no body JSON o campo **`whatsapp_profile_name`** (junto com `business_id`, `customer_phone`, etc.).
3. O roteador grava **`customer_name`** no contexto da conversa e o payload de agendamento envia **`customerName`** para `POST /api/appointments`.
4. O backend usa isso em **`ensureCustomerForAppointment`**: o cadastro em **Clientes** recebe esse nome quando o cliente ainda não existia.

## Observações

- Em algumas mensagens a Meta **não** repete `contacts`; o nome pode aparecer só na primeira mensagem da sessão. Por isso o fluxo também persiste `customer_name` no **estado da conversa** quando disponível.
- Se o nome do perfil WhatsApp estiver vazio ou for genérico, o sistema continua usando o fallback `Cliente WhatsApp (XXXX)`.
