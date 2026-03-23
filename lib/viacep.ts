export type ViaCepSuccess = {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
};

/**
 * Consulta ViaCEP (8 dígitos, sem máscara).
 * Retorna endereço ou mensagem de erro para exibir no painel.
 */
export async function lookupViaCep(
  cepDigits: string
): Promise<{ ok: true; data: ViaCepSuccess } | { ok: false; message: string }> {
  try {
    const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
    const result = (await response.json()) as {
      erro?: boolean;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
    };

    if (!response.ok || result.erro) {
      return { ok: false, message: "CEP nao encontrado." };
    }

    return {
      ok: true,
      data: {
        logradouro: result.logradouro || "",
        bairro: result.bairro || "",
        localidade: result.localidade || "",
        uf: result.uf || ""
      }
    };
  } catch {
    return { ok: false, message: "Falha ao consultar CEP." };
  }
}
