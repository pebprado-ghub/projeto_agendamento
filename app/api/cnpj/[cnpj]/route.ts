import { NextRequest, NextResponse } from "next/server";

type Params = { params: { cnpj: string } };

type BrasilApiCnpj = {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  cnae_fiscal?: number | string;
  cnae_fiscal_descricao?: string;
};

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const cnpjDigits = (params.cnpj || "").replace(/\D/g, "");
    if (cnpjDigits.length !== 14) {
      return NextResponse.json({ error: "CNPJ invalido." }, { status: 400 });
    }

    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits}`, {
      cache: "no-store"
    });
    const result = (await response.json()) as BrasilApiCnpj & { message?: string };

    if (!response.ok) {
      return NextResponse.json(
        { error: result.message || "CNPJ nao encontrado." },
        { status: response.status === 404 ? 404 : 500 }
      );
    }

    return NextResponse.json({
      data: {
        cnpj: result.cnpj || cnpjDigits,
        legalName: result.razao_social || "",
        tradeName: result.nome_fantasia || "",
        addressLine: result.logradouro || "",
        addressNumber: result.numero || "",
        addressComplement: result.complemento || "",
        neighborhood: result.bairro || "",
        city: result.municipio || "",
        state: result.uf || "",
        postalCode: result.cep || "",
        cnaeCode: String(result.cnae_fiscal || ""),
        cnaeDescription: result.cnae_fiscal_descricao || ""
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Falha na consulta do CNPJ." },
      { status: 500 }
    );
  }
}
