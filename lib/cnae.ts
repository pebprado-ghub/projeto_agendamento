export type CnaeOption = {
  code: string;
  description: string;
  templateKey: string;
};

export const CNAE_OPTIONS: CnaeOption[] = [
  { code: "9602-5/01", description: "Cabeleireiros, manicure e pedicure", templateKey: "Salão de beleza" },
  { code: "9602-5/02", description: "Atividades de estética e outros serviços de cuidados com a beleza", templateKey: "Designer de sobrancelhas" },
  { code: "9602-5/03", description: "Atividades de maquiagem e design pessoal", templateKey: "Designer de sobrancelhas" },
  { code: "9602-5/04", description: "Serviços de barbearia", templateKey: "Barbearia" },
  { code: "9609-2/06", description: "Serviços de tatuagem e piercing", templateKey: "Tatuagem" },
  { code: "8650-0/03", description: "Atividades de psicologia e psicanálise", templateKey: "Psicologia" },
  { code: "8650-0/02", description: "Atividades de profissionais da nutrição", templateKey: "Nutrição" },
  { code: "9313-1/00", description: "Atividades de condicionamento físico", templateKey: "Personal Trainer" },
  { code: "9609-2/99", description: "Outras atividades de serviços pessoais", templateKey: "Massoterapia" },
  { code: "7420-0/01", description: "Atividades de produção de fotografias", templateKey: "Fotografia" },
  { code: "7410-2/99", description: "Atividades de design não especificadas anteriormente", templateKey: "Consultoria" },
  { code: "7112-0/00", description: "Serviços de engenharia", templateKey: "Consultoria" },
  { code: "4321-5/00", description: "Instalação e manutenção elétrica", templateKey: "Eletricista" },
  { code: "4322-3/01", description: "Instalações hidráulicas, sanitárias e de gás", templateKey: "Encanador" }
];

export function getCnaeByCode(code?: string | null) {
  if (!code) return null;
  return CNAE_OPTIONS.find((item) => item.code === code) || null;
}
