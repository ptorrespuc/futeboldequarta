import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

type EmailActionType =
  | "signup"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "email";

type SendEmailPayload = {
  user: {
    email: string;
    new_email?: string;
    user_metadata?: {
      full_name?: string;
      name?: string;
    };
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: EmailActionType;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
    old_email?: string;
  };
};

type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

const mailtrapUrl = "https://send.api.mailtrap.io/api/send";
const hookSecret = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "").replace("v1,whsec_", "");
const mailtrapToken = Deno.env.get("MAILTRAP_API_TOKEN") ?? "";
const fromEmail = Deno.env.get("MAILTRAP_FROM_EMAIL") ?? "hello@demomailtrap.co";
const fromName = Deno.env.get("MAILTRAP_FROM_NAME") ?? "Futebol de Quarta";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function resolveRecipientName(payload: SendEmailPayload) {
  return payload.user.user_metadata?.full_name?.trim() || payload.user.user_metadata?.name?.trim() || "jogador";
}

function buildActionUrl(input: {
  actionType: EmailActionType;
  tokenHash: string;
  redirectTo?: string;
  fallbackUrl?: string;
}) {
  const fallbackPath =
    input.actionType === "recovery" ? "futeboldequarta://reset-password" : "futeboldequarta://login";
  const target = new URL(input.redirectTo || input.fallbackUrl || fallbackPath);

  target.searchParams.set("token_hash", input.tokenHash);
  target.searchParams.set("type", input.actionType);

  return target.toString();
}

function getActionContent(actionType: EmailActionType, actionUrl: string, recipientName: string) {
  const greeting = `Ola, ${recipientName}.`;

  switch (actionType) {
    case "signup":
      return {
        subject: "Confirme seu cadastro no Futebol de Quarta",
        preview: "Seu cadastro esta quase pronto.",
        title: "Confirme seu cadastro",
        body: `${greeting} Toque no botao abaixo para validar seu email e entrar no app.`,
        ctaLabel: "Confirmar cadastro",
        actionUrl,
      };
    case "recovery":
      return {
        subject: "Redefina sua senha no Futebol de Quarta",
        preview: "Recebemos um pedido para redefinir sua senha.",
        title: "Redefinir senha",
        body: `${greeting} Use o link abaixo para autorizar a troca da sua senha no app.`,
        ctaLabel: "Criar nova senha",
        actionUrl,
      };
    case "invite":
      return {
        subject: "Seu acesso ao Futebol de Quarta foi liberado",
        preview: "Voce recebeu um convite para entrar no app.",
        title: "Voce foi convidado",
        body: `${greeting} Abra o link abaixo para aceitar o convite e concluir seu acesso.`,
        ctaLabel: "Aceitar convite",
        actionUrl,
      };
    case "magiclink":
    case "email":
      return {
        subject: "Seu link de acesso do Futebol de Quarta",
        preview: "Entre no app com este link seguro.",
        title: "Entrar no app",
        body: `${greeting} Use o botao abaixo para concluir o acesso ao Futebol de Quarta.`,
        ctaLabel: "Entrar agora",
        actionUrl,
      };
    case "email_change":
      return {
        subject: "Confirme a alteracao de email no Futebol de Quarta",
        preview: "Estamos validando a troca de email da sua conta.",
        title: "Confirmar alteracao de email",
        body: `${greeting} Toque no botao abaixo para confirmar a alteracao de email da sua conta.`,
        ctaLabel: "Confirmar alteracao",
        actionUrl,
      };
  }
}

function renderEmailHtml(input: {
  preview: string;
  title: string;
  body: string;
  ctaLabel: string;
  actionUrl: string;
}) {
  const preview = escapeHtml(input.preview);
  const title = escapeHtml(input.title);
  const body = escapeHtml(input.body);
  const ctaLabel = escapeHtml(input.ctaLabel);
  const actionUrl = escapeHtml(input.actionUrl);

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body style="margin:0;background:#f4f5ee;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#183425;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preview}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;border-collapse:collapse;background:#173f2a;border-radius:28px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 20px;color:#eff47a;font-size:13px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;">
                Futebol de Quarta
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 16px;color:#ffffff;font-size:30px;font-weight:900;line-height:1.2;">
                ${title}
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px;color:#d7e3d8;font-size:16px;line-height:1.65;">
                ${body}
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 18px;">
                <a href="${actionUrl}" style="display:inline-block;background:#eff47a;color:#173f2a;text-decoration:none;font-size:15px;font-weight:800;padding:14px 22px;border-radius:999px;">
                  ${ctaLabel}
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;color:#b9cdbd;font-size:13px;line-height:1.6;">
                Se o botao nao abrir, copie este link no seu aparelho:<br />
                <span style="word-break:break-all;">${actionUrl}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function renderEmailText(input: {
  title: string;
  body: string;
  ctaLabel: string;
  actionUrl: string;
}) {
  return [input.title, "", input.body, "", `${input.ctaLabel}: ${input.actionUrl}`].join("\n");
}

function createMessage(input: {
  recipientName: string;
  recipientEmail: string;
  actionType: EmailActionType;
  tokenHash: string;
  redirectTo?: string;
  fallbackUrl?: string;
}) {
  const actionUrl = buildActionUrl({
    actionType: input.actionType,
    tokenHash: input.tokenHash,
    redirectTo: input.redirectTo,
    fallbackUrl: input.fallbackUrl,
  });
  const content = getActionContent(input.actionType, actionUrl, input.recipientName);

  return {
    to: input.recipientEmail,
    subject: content.subject,
    html: renderEmailHtml(content),
    text: renderEmailText(content),
  } satisfies OutgoingEmail;
}

function buildMessages(payload: SendEmailPayload) {
  const recipientName = resolveRecipientName(payload);
  const { email_data: emailData, user } = payload;

  if (emailData.email_action_type !== "email_change") {
    return [
      createMessage({
        recipientName,
        recipientEmail: user.email,
        actionType: emailData.email_action_type,
        tokenHash: emailData.token_hash,
        redirectTo: emailData.redirect_to,
        fallbackUrl: emailData.site_url,
      }),
    ];
  }

  const messages: OutgoingEmail[] = [];

  if (user.email && emailData.token_hash_new) {
    messages.push(
      createMessage({
        recipientName,
        recipientEmail: user.email,
        actionType: "email_change",
        tokenHash: emailData.token_hash_new,
        redirectTo: emailData.redirect_to,
        fallbackUrl: emailData.site_url,
      }),
    );
  }

  const newEmail = user.new_email?.trim();
  const tokenHashForNewEmail = emailData.token_hash?.trim();

  if (newEmail && tokenHashForNewEmail) {
    messages.push(
      createMessage({
        recipientName,
        recipientEmail: newEmail,
        actionType: "email_change",
        tokenHash: tokenHashForNewEmail,
        redirectTo: emailData.redirect_to,
        fallbackUrl: emailData.site_url,
      }),
    );
  }

  if (messages.length > 0) {
    return messages;
  }

  return [
    createMessage({
      recipientName,
      recipientEmail: newEmail || user.email,
      actionType: "email_change",
      tokenHash: tokenHashForNewEmail || emailData.token_hash_new || emailData.token_hash,
      redirectTo: emailData.redirect_to,
      fallbackUrl: emailData.site_url,
    }),
  ];
}

async function sendViaMailtrap(message: OutgoingEmail) {
  const response = await fetch(mailtrapUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${mailtrapToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: {
        email: fromEmail,
        name: fromName,
      },
      to: [{ email: message.to }],
      subject: message.subject,
      html: message.html,
      text: message.text,
      category: "Supabase Auth",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Mailtrap returned ${response.status}: ${body}`);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("not allowed", { status: 400 });
  }

  if (!hookSecret || !mailtrapToken) {
    return new Response(
      JSON.stringify({
        error: {
          http_code: 500,
          message: "Missing SEND_EMAIL_HOOK_SECRET or MAILTRAP_API_TOKEN.",
        },
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const webhook = new Webhook(hookSecret);

  try {
    const verifiedPayload = webhook.verify(payload, headers) as SendEmailPayload;
    const messages = buildMessages(verifiedPayload);

    for (const message of messages) {
      await sendViaMailtrap(message);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unhandled send email error.";

    return new Response(
      JSON.stringify({
        error: {
          http_code: 401,
          message,
        },
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
