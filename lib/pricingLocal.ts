const UF_FACTOR: Record<string, number> = {
  AC: 0.92,
  AL: 0.92,
  AM: 0.95,
  AP: 0.9,
  BA: 0.96,
  CE: 0.95,
  DF: 1.15,
  ES: 1.01,
  GO: 0.99,
  MA: 0.9,
  MG: 1.0,
  MS: 0.97,
  MT: 0.97,
  PA: 0.92,
  PB: 0.9,
  PE: 0.95,
  PI: 0.9,
  PR: 1.03,
  RJ: 1.12,
  RN: 0.92,
  RO: 0.93,
  RR: 0.92,
  RS: 1.05,
  SC: 1.06,
  SE: 0.92,
  SP: 1.12,
  TO: 0.92
};

const CAPITAL_BONUS = 1.06;
const CAPITALS = new Set([
  "rio branco",
  "maceio",
  "macapa",
  "manaus",
  "salvador",
  "fortaleza",
  "brasilia",
  "vitoria",
  "goiania",
  "sao luis",
  "cuiaba",
  "campo grande",
  "belo horizonte",
  "belem",
  "joao pessoa",
  "curitiba",
  "recife",
  "teresina",
  "rio de janeiro",
  "natal",
  "porto alegre",
  "porto velho",
  "boa vista",
  "florianopolis",
  "sao paulo",
  "aracaju",
  "palmas"
]);

function normalizeCity(value?: string | null) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Proxy de preço médio local (não é cotação em tempo real). */
export function getLocalPriceFactor(state?: string | null, city?: string | null) {
  const uf = (state || "").trim().toUpperCase();
  const base = UF_FACTOR[uf] || 1;
  const cityNorm = normalizeCity(city);
  const bonus = CAPITALS.has(cityNorm) ? CAPITAL_BONUS : 1;
  return base * bonus;
}
