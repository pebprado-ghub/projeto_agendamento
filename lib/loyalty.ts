type LevelCode = "bronze" | "prata" | "ouro" | "platina";

export function pointsFromPayment(amountCents: number) {
  // Regra: a cada R$10 = 1 ponto
  return Math.max(0, Math.floor(Number(amountCents || 0) / 1000));
}

export function discountCentsFromPoints(points: number) {
  // Regra: 100 pontos = R$10
  return Math.max(0, Math.floor(Number(points || 0) / 100) * 1000);
}

export function levelFromLifetimePoints(lifetimePoints: number): LevelCode {
  const p = Math.max(0, Number(lifetimePoints || 0));
  if (p >= 1000) return "platina";
  if (p >= 500) return "ouro";
  if (p >= 200) return "prata";
  return "bronze";
}
