import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "jsr:@supabase/supabase-js@2";

type ProvisionPlayerAccessInput = {
  accountId?: string;
  email?: string;
  fullName?: string;
};

type JsonRecord = Record<string, unknown>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(status: number, payload: JsonRecord) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function getReadableError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Nao foi possivel provisionar o acesso do jogador.";
}

function isEmailRateLimitError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.toLowerCase().includes("email rate limit exceeded");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." });
  }

  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse(401, { error: "Missing bearer token." });
  }

  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const body = (await req.json()) as ProvisionPlayerAccessInput;
    const accountId = body.accountId?.trim();
    const fullName = body.fullName?.trim();
    const email = body.email ? normalizeEmail(body.email) : "";

    if (!accountId || !fullName || !email || !email.includes("@")) {
      return jsonResponse(400, {
        error: "Informe conta, nome completo e email valido para provisionar o acesso.",
      });
    }

    const {
      data: { user: actorUser },
      error: actorError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (actorError || !actorUser) {
      return jsonResponse(401, { error: actorError?.message ?? "Sessao invalida." });
    }

    const { data: actorProfile, error: actorProfileError } = await supabaseAdmin
      .from("profiles")
      .select("id, is_super_admin")
      .eq("id", actorUser.id)
      .maybeSingle();

    if (actorProfileError) {
      throw actorProfileError;
    }

    if (!actorProfile) {
      return jsonResponse(403, { error: "Perfil do operador nao encontrado." });
    }

    if (!actorProfile.is_super_admin) {
      const { data: membership, error: membershipError } = await supabaseAdmin
        .from("account_memberships")
        .select("id, role")
        .eq("account_id", accountId)
        .eq("profile_id", actorUser.id)
        .eq("is_active", true)
        .maybeSingle();

      if (membershipError) {
        throw membershipError;
      }

      if (!membership || membership.role !== "group_admin") {
        return jsonResponse(403, { error: "Somente superadmin ou admin do grupo podem criar acessos." });
      }
    }

    const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .ilike("email", email)
      .maybeSingle();

    if (existingProfileError) {
      throw existingProfileError;
    }

    if (existingProfile) {
      return jsonResponse(200, {
        profileId: existingProfile.id,
        email: existingProfile.email,
        fullName: existingProfile.full_name,
        invited: false,
        alreadyExisted: true,
      });
    }

    let invitedUser = null;
    let manualActionLink: string | null = null;
    let inviteDelivery: "email" | "manual_link" = "email";

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          full_name: fullName,
          name: fullName,
        },
        redirectTo: "borajogar://reset-password",
      },
    );

    if (inviteError) {
      if (!isEmailRateLimitError(inviteError)) {
        throw inviteError;
      }

      const { data: generatedLinkData, error: generatedLinkError } =
        await supabaseAdmin.auth.admin.generateLink({
          type: "invite",
          email,
          options: {
            data: {
              full_name: fullName,
              name: fullName,
            },
            redirectTo: "borajogar://reset-password",
          },
        });

      if (generatedLinkError) {
        throw generatedLinkError;
      }

      invitedUser = generatedLinkData.user;
      manualActionLink = generatedLinkData.properties.action_link;
      inviteDelivery = "manual_link";
    } else {
      invitedUser = inviteData.user;
    }

    if (!invitedUser) {
      throw new Error("O Auth nao retornou o usuario convidado.");
    }

    const { error: upsertProfileError } = await supabaseAdmin.from("profiles").upsert(
      {
        id: invitedUser.id,
        full_name: fullName,
        email,
      },
      {
        onConflict: "id",
      },
    );

    if (upsertProfileError) {
      throw upsertProfileError;
    }

    return jsonResponse(200, {
      profileId: invitedUser.id,
      email,
      fullName,
      invited: true,
      alreadyExisted: false,
      inviteDelivery,
      manualActionLink,
    });
  } catch (error) {
    return jsonResponse(500, { error: getReadableError(error) });
  }
});
