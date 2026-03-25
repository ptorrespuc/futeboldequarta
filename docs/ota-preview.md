# OTA Preview

O projeto agora esta configurado para usar EAS Update nos canais:

- `development`
- `preview`
- `production`

## Primeiro passo obrigatorio

Como o app recebeu configuracao nativa de OTA (`expo-updates`, `runtimeVersion`, `updates.url`), voce ainda precisa gerar um novo build `preview` uma vez.

Exemplo:

```bash
eas build --platform android --profile preview
```

Depois que esse APK novo estiver instalado, alteracoes de interface, texto, regras JavaScript e assets poderao ser publicadas sem rebuild completo, desde que nao mudem a parte nativa.

## Publicar uma atualizacao OTA para preview

```bash
eas update --channel preview --environment preview --message "Ajustes de interface"
```

## Publicar uma atualizacao OTA para production

```bash
eas update --channel production --environment production --message "Correcao de producao"
```

## Quando o OTA nao basta

Voce ainda precisa de um novo build quando houver mudanca em:

- `android.package`
- `ios.bundleIdentifier`
- `scheme`
- bibliotecas nativas
- permissoes nativas
- qualquer alteracao que mude o runtime nativo do app

## Runtime atual

O projeto usa:

- `runtimeVersion.policy = appVersion`

Isso significa que updates OTA sao compartilhados entre builds com a mesma versao do app. Quando houver uma mudanca nativa relevante, gere um novo build e suba a `version` do app.
