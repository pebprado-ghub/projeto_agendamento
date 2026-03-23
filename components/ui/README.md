# Kit UI do Projeto

Este diretório concentra os componentes base de interface para manter consistência visual e de comportamento no painel.

## Princípios do padrão

- Usar componentes de `components/ui` em vez de elementos HTML crus (`button`, `input`, etc.) em telas de produto.
- Priorizar textos curtos, objetivos e com ortografia correta.
- Manter feedbacks de sucesso/erro próximos da ação que os gerou.
- Reaproveitar componentes de seção em `components/admin` para evitar duplicidade de layout.

## Componentes disponíveis

- `Button`
- `Input`
- `Select`
- `Textarea`
- `Tabs`
- `Card`
- `Checkbox`

## Exemplos rápidos

### Button

```tsx
import { Button } from "@/components/ui/button";

<Button>Salvar</Button>
<Button variant="outline">Cancelar</Button>
<Button variant="ghost" size="sm">Editar</Button>
```

### Input / Select / Textarea

```tsx
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

<Input placeholder="Nome do negócio" />
<Select defaultValue="internal">
  <option value="internal">Interna</option>
  <option value="google">Google Calendar</option>
</Select>
<Textarea rows={3} placeholder="Mensagem padrão" />
```

### Tabs

```tsx
import { Tabs } from "@/components/ui/tabs";

<Tabs
  value={activeTab}
  onChange={setActiveTab}
  items={[
    { value: "configuration", label: "Configuração" },
    { value: "dashboard", label: "Dashboard" }
  ]}
/>
```

### Checkbox

```tsx
import { Checkbox } from "@/components/ui/checkbox";

<Checkbox
  checked={isActive}
  onChange={(event) => setIsActive(event.target.checked)}
  label="Segunda-feira"
/>
```

## Convenções de implementação

- **Ações primárias**: `Button` padrão.
- **Ações secundárias**: `Button variant="outline"`.
- **Ações de baixo risco em lista**: `Button variant="ghost" size="sm"`.
- **Campos de formulário**: usar `Input`, `Select`, `Textarea` e `Checkbox`.
- **Seções administrativas**: usar `AdminCard`, `FieldGroup` e `MetricCard`.

## Checklist antes de concluir uma tela

- A tela usa componentes de `components/ui`.
- Não há controles HTML crus sem necessidade real.
- Textos estão em PT-BR com acentuação adequada.
- Estados de loading/erro/sucesso foram contemplados.
- Lint sem erros.
