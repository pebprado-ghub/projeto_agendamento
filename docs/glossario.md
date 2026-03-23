# Glossário — nomenclatura (desenvolvimento)



**Na interface do produto** o usuário do painel do negócio (`session_role === "owner"`, legado `client`) vê **“Clientes”** no CRM (pessoas atendidas). Não há distinção “primário/secundário” nesse rótulo na UI.



Os termos abaixo existem **só para desenvolvimento, documentação e alinhamento com IA**, para não confundir o login do painel com os contatos em `customers`.



| Termo | Significado |

|--------|-------------|

| **Desenvolvedor** | Pessoa que mantém **a ferramenta/plataforma**: multi-negócio, cadastros centrais, visão global. No código e na sessão: papel `developer` (cookie legado: `admin`). |

| **Administrador** (do negócio) | Empresário/autônomo que **usa o painel** do seu negócio: WhatsApp, serviços, agenda, templates. No código e na sessão: papel `owner` (cookie legado: `client`). |

| **Cliente** (CRM) | Pessoa atendida pelo negócio: agenda pelo WhatsApp ou está em **Clientes**. Tabela `customers`. **Não** é o mesmo que o papel `owner` do painel. |



## Mapeamento rápido (código)



| Onde | O que significa na nomenclatura |

|------|----------------------------------|

| `session_role === "developer"` (legado `admin`) | Sessão do **Desenvolvedor** |

| `session_role === "owner"` (legado `client`) | Sessão do **Administrador** do negócio |

| Tabela `businesses` | Dados do negócio do administrador |

| Tabela `customers` | Contatos do negócio (na UI: **“Clientes”**). `full_name` = nome editável no CRM; `whatsapp_profile_name` = nome do perfil WhatsApp (somente leitura no painel). |

| “Painel do negócio” na UI | Área logada do `owner` |



## Frases modelo



- “O **Desenvolvedor** cadastrou um novo negócio.”

- “O **Administrador** alterou o horário de atendimento.”

- “O **cliente** João agendou um corte pelo WhatsApp.”



---



*Atualize este arquivo se surgirem novos papéis (ex.: franqueado, filial).*

