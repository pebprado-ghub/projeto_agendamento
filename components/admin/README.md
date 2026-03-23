# Padrão de Telas Administrativas

Este diretório define como compor telas de administração com consistência visual, clareza de fluxo e baixa duplicação.

## Componentes base

- `AdminCard`: bloco principal de conteúdo por seção.
- `FieldGroup`: agrupador semântico de campos relacionados.
- `MetricCard`: card compacto para indicadores.
- `SectionHeader`: cabeçalho de seção com título, descrição e ações.

## Estrutura recomendada de página admin

1. **Cabeçalho da página**
   - título principal
   - descrição curta da área
   - ações globais (quando necessário)

2. **Navegação de contexto**
   - abas (`Tabs`) para separar áreas grandes (ex.: Configuração e Dashboard)

3. **Seções em `AdminCard`**
   - cada objetivo de negócio em um card distinto
   - descrições curtas e orientadas a ação

4. **Formulários com `FieldGroup`**
   - agrupamento por tema (ex.: Identificação, Endereço, Operação)
   - feedback próximo da ação (erro/sucesso)

5. **Indicadores com `MetricCard`**
   - visão rápida de status da operação
   - priorizar métricas úteis para decisão

## Exemplo de composição

```tsx
<AdminCard title="Cadastro de negócio" description="Defina os dados principais.">
  <form className="form">
    <FieldGroup title="Identificação">
      {/* campos */}
    </FieldGroup>
    <FieldGroup title="Contato">
      {/* campos */}
    </FieldGroup>
  </form>
</AdminCard>
```

## Convenções de texto (PT-BR)

- Títulos: claros e diretos.
- Descrições: objetivas, orientadas ao que o usuário deve fazer.
- Labels: curtos, com linguagem de negócio.
- Mensagens de erro: explicam causa e ação corretiva.

## Convenções de ação

- Primária: `Button` padrão (`Salvar`, `Criar`, `Atualizar`).
- Secundária: `Button variant="outline"` (`Cancelar`, `Voltar`).
- Ação de lista: `Button variant="ghost" size="sm"` (`Editar`, `Excluir` quando aplicável).

## Checklist de qualidade

- A tela está organizada por contexto (não mistura configuração e gestão sem separação).
- Layout usa componentes de `components/admin` e `components/ui`.
- Sem duplicidade de blocos com mesma finalidade.
- Textos com ortografia e acentuação corretas.
- Estados de loading, sucesso e erro implementados.
- Lint sem erros antes da entrega.
