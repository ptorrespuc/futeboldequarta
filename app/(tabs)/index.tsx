import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import Colors from "@/constants/Colors";
import {
  createSportModality,
  createSportsAccount,
  findProfileByEmail,
  getAccountOverview,
  listAllSportsAccounts,
  listSportModalities,
  upsertAccountMembership,
  updateSportsAccountBasics,
  type AccountOverview,
} from "@/src/lib/accounts";
import { useAuth } from "@/src/providers/auth-provider";
import type { AccountRole, SportModality, SportsAccount } from "@/src/types/domain";

const roleLabels: Record<AccountRole, string> = {
  group_admin: "Admin do grupo",
  group_moderator: "Moderador do grupo",
  player: "Jogador",
};

const weekdayLabels = [
  "Domingo",
  "Segunda",
  "Terca",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sabado",
];

const priorityColors = ["#1d7f46", "#5a9b3c", "#88938c", "#4d7c66", "#9aac8f"];

type AccountAccessItem = {
  account: SportsAccount;
  roleLabel: string;
  membershipRole: AccountRole | null;
  priorityGroupName: string | null;
};

function getReadableError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Nao foi possivel carregar os dados da conta.";
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function isValidHourMinute(value: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function parsePriorityGroups(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((name, index) => ({
      name,
      colorHex: priorityColors[index] ?? null,
    }));
}

function parsePositions(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

function formatSchedule(weekday: number, startsAt: string, endsAt: string) {
  return `${weekdayLabels[weekday] ?? "Dia"} | ${startsAt.slice(0, 5)} as ${endsAt.slice(0, 5)}`;
}

export default function HomeScreen() {
  const { profile, memberships, error, signOut, refresh } = useAuth();
  const [superAdminAccounts, setSuperAdminAccounts] = useState<SportsAccount[]>([]);
  const [modalities, setModalities] = useState<SportModality[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [isOverviewLoading, setIsOverviewLoading] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isCreatingModality, setIsCreatingModality] = useState(false);
  const [isLinkingMember, setIsLinkingMember] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const [accountNameDraft, setAccountNameDraft] = useState("");
  const [maxPlayersDraft, setMaxPlayersDraft] = useState("");
  const [openHoursDraft, setOpenHoursDraft] = useState("");
  const [closeMinutesDraft, setCloseMinutesDraft] = useState("");

  const [createModalityNameDraft, setCreateModalityNameDraft] = useState("");
  const [createModalitySlugDraft, setCreateModalitySlugDraft] = useState("");
  const [createModalityPlayersDraft, setCreateModalityPlayersDraft] = useState("5");
  const [createModalityPositionsDraft, setCreateModalityPositionsDraft] = useState(
    "Goleiro, Zagueiro, Ala, Meio-campo, Atacante",
  );

  const [createNameDraft, setCreateNameDraft] = useState("");
  const [createSlugDraft, setCreateSlugDraft] = useState("");
  const [createModalityId, setCreateModalityId] = useState<string | null>(null);
  const [createWeekday, setCreateWeekday] = useState("3");
  const [createStartsAt, setCreateStartsAt] = useState("20:30");
  const [createEndsAt, setCreateEndsAt] = useState("22:00");
  const [createMaxPlayers, setCreateMaxPlayers] = useState("20");
  const [createOpenHours, setCreateOpenHours] = useState("48");
  const [createCloseMinutes, setCreateCloseMinutes] = useState("120");
  const [createPriorityGroups, setCreatePriorityGroups] = useState(
    "Prioridade 1, Prioridade 2, Lista geral",
  );
  const [memberEmailDraft, setMemberEmailDraft] = useState("");
  const [memberRoleDraft, setMemberRoleDraft] = useState<AccountRole>("player");
  const [memberPriorityGroupId, setMemberPriorityGroupId] = useState<string | null>(null);

  useEffect(() => {
    setCreateSlugDraft(slugify(createNameDraft));
  }, [createNameDraft]);

  useEffect(() => {
    setCreateModalitySlugDraft(slugify(createModalityNameDraft));
  }, [createModalityNameDraft]);

  useEffect(() => {
    let isActive = true;

    async function loadAdminData() {
      if (!profile?.is_super_admin) {
        setSuperAdminAccounts([]);
        setModalities([]);
        setCreateModalityId(null);
        return;
      }

      setIsAdminLoading(true);

      try {
        const [nextAccounts, nextModalities] = await Promise.all([
          listAllSportsAccounts(),
          listSportModalities(),
        ]);

        if (!isActive) {
          return;
        }

        setSuperAdminAccounts(nextAccounts);
        setModalities(nextModalities);

        if (nextModalities.length === 0) {
          setCreateModalityId(null);
        } else if (!createModalityId || !nextModalities.some((item) => item.id === createModalityId)) {
          setCreateModalityId(nextModalities[0].id);
        }
      } catch (loadError) {
        if (isActive) {
          setMessage({ tone: "error", text: getReadableError(loadError) });
        }
      } finally {
        if (isActive) {
          setIsAdminLoading(false);
        }
      }
    }

    void loadAdminData();

    return () => {
      isActive = false;
    };
  }, [profile?.is_super_admin, createModalityId]);

  const availableAccounts = (() => {
    const accountMap = new Map<string, AccountAccessItem>();

    for (const membership of memberships) {
      accountMap.set(membership.account.id, {
        account: membership.account,
        roleLabel: roleLabels[membership.membership.role],
        membershipRole: membership.membership.role,
        priorityGroupName: membership.priorityGroup?.name ?? null,
      });
    }

    if (profile?.is_super_admin) {
      for (const account of superAdminAccounts) {
        if (!accountMap.has(account.id)) {
          accountMap.set(account.id, {
            account,
            roleLabel: "Super admin",
            membershipRole: null,
            priorityGroupName: null,
          });
        }
      }
    }

    return [...accountMap.values()].sort((a, b) => a.account.name.localeCompare(b.account.name));
  })();

  const selectedAccess = availableAccounts.find((item) => item.account.id === selectedAccountId) ?? null;
  const selectedMembership = memberships.find((item) => item.account.id === selectedAccountId) ?? null;

  useEffect(() => {
    if (availableAccounts.length === 0) {
      setSelectedAccountId(null);
      return;
    }

    if (!availableAccounts.some((item) => item.account.id === selectedAccountId)) {
      setSelectedAccountId(availableAccounts[0].account.id);
    }
  }, [availableAccounts, selectedAccountId]);

  useEffect(() => {
    let isActive = true;

    async function loadOverview() {
      if (!selectedAccess) {
        setOverview(null);
        setOverviewError(null);
        return;
      }

      setIsOverviewLoading(true);
      setOverviewError(null);

      try {
        const nextOverview = await getAccountOverview(selectedAccess.account.id);

        if (!isActive) {
          return;
        }

        setOverview(nextOverview);
      } catch (loadError) {
        if (isActive) {
          setOverview(null);
          setOverviewError(getReadableError(loadError));
        }
      } finally {
        if (isActive) {
          setIsOverviewLoading(false);
        }
      }
    }

    void loadOverview();

    return () => {
      isActive = false;
    };
  }, [selectedAccess]);

  useEffect(() => {
    if (!overview) {
      setAccountNameDraft("");
      setMaxPlayersDraft("");
      setOpenHoursDraft("");
      setCloseMinutesDraft("");
      return;
    }

    setAccountNameDraft(overview.account.name);
    setMaxPlayersDraft(String(overview.account.max_players_per_event));
    setOpenHoursDraft(String(overview.account.confirmation_open_hours_before));
    setCloseMinutesDraft(String(overview.account.confirmation_close_minutes_before));
  }, [overview]);

  useEffect(() => {
    if (memberRoleDraft !== "player") {
      setMemberPriorityGroupId(null);
      return;
    }

    if (!overview || overview.priorityGroups.length === 0) {
      setMemberPriorityGroupId(null);
      return;
    }

    setMemberPriorityGroupId((currentValue) =>
      currentValue && overview.priorityGroups.some((group) => group.id === currentValue)
        ? currentValue
        : overview.priorityGroups[0].id,
    );
  }, [memberRoleDraft, overview]);

  async function reloadAccounts() {
    if (!profile?.is_super_admin) {
      return;
    }

    setSuperAdminAccounts(await listAllSportsAccounts());
  }

  async function reloadModalities() {
    if (!profile?.is_super_admin) {
      return;
    }

    const nextModalities = await listSportModalities();
    setModalities(nextModalities);

    if (nextModalities.length === 0) {
      setCreateModalityId(null);
      return;
    }

    setCreateModalityId((currentValue) =>
      currentValue && nextModalities.some((item) => item.id === currentValue)
        ? currentValue
        : nextModalities[0].id,
    );
  }

  async function handleSaveAccount() {
    if (!overview) {
      return;
    }

    const maxPlayersPerEvent = Number(maxPlayersDraft);
    const confirmationOpenHoursBefore = Number(openHoursDraft);
    const confirmationCloseMinutesBefore = Number(closeMinutesDraft);

    if (
      !accountNameDraft.trim() ||
      !Number.isInteger(maxPlayersPerEvent) ||
      maxPlayersPerEvent <= 0 ||
      !Number.isInteger(confirmationOpenHoursBefore) ||
      confirmationOpenHoursBefore < 0 ||
      !Number.isInteger(confirmationCloseMinutesBefore) ||
      confirmationCloseMinutesBefore < 0
    ) {
      setOverviewError("Revise os campos da conta esportiva.");
      return;
    }

    setIsSavingAccount(true);
    setOverviewError(null);

    try {
      await updateSportsAccountBasics({
        accountId: overview.account.id,
        name: accountNameDraft.trim(),
        maxPlayersPerEvent,
        confirmationOpenHoursBefore,
        confirmationCloseMinutesBefore,
      });

      setOverview(await getAccountOverview(overview.account.id));
      await reloadAccounts();
      await refresh();
      setMessage({ tone: "success", text: "Conta esportiva atualizada." });
    } catch (saveError) {
      setOverviewError(getReadableError(saveError));
    } finally {
      setIsSavingAccount(false);
    }
  }

  async function handleCreateAccount() {
    if (!profile) {
      return;
    }

    const slug = createSlugDraft.trim() || slugify(createNameDraft);
    const maxPlayersPerEvent = Number(createMaxPlayers);
    const confirmationOpenHoursBefore = Number(createOpenHours);
    const confirmationCloseMinutesBefore = Number(createCloseMinutes);
    const weekday = Number(createWeekday);
    const priorityGroups = parsePriorityGroups(createPriorityGroups);

    if (
      !createNameDraft.trim() ||
      !slug ||
      !createModalityId ||
      !Number.isInteger(weekday) ||
      weekday < 0 ||
      weekday > 6 ||
      !isValidHourMinute(createStartsAt) ||
      !isValidHourMinute(createEndsAt) ||
      !Number.isInteger(maxPlayersPerEvent) ||
      maxPlayersPerEvent <= 0 ||
      !Number.isInteger(confirmationOpenHoursBefore) ||
      confirmationOpenHoursBefore < 0 ||
      !Number.isInteger(confirmationCloseMinutesBefore) ||
      confirmationCloseMinutesBefore < 0 ||
      priorityGroups.length === 0
    ) {
      setMessage({ tone: "error", text: "Revise os dados da nova conta esportiva." });
      return;
    }

    setIsCreatingAccount(true);
    setMessage(null);

    try {
      const createdAccount = await createSportsAccount({
        createdBy: profile.id,
        name: createNameDraft.trim(),
        slug,
        modalityId: createModalityId,
        timezone: "America/Sao_Paulo",
        maxPlayersPerEvent,
        confirmationOpenHoursBefore,
        confirmationCloseMinutesBefore,
        autoNotifyConfirmationOpen: true,
        autoNotifyWaitlistChanges: true,
        autoNotifyEventUpdates: true,
        schedule: {
          weekday,
          startsAt: createStartsAt,
          endsAt: createEndsAt,
        },
        priorityGroups,
      });

      await reloadAccounts();
      setSelectedAccountId(createdAccount.id);
      setCreateNameDraft("");
      setCreateSlugDraft("");
      setCreateWeekday("3");
      setCreateStartsAt("20:30");
      setCreateEndsAt("22:00");
      setCreateMaxPlayers("20");
      setCreateOpenHours("48");
      setCreateCloseMinutes("120");
      setCreatePriorityGroups("Prioridade 1, Prioridade 2, Lista geral");
      setMessage({ tone: "success", text: "Conta esportiva criada com sucesso." });
    } catch (createError) {
      setMessage({ tone: "error", text: getReadableError(createError) });
    } finally {
      setIsCreatingAccount(false);
    }
  }

  async function handleCreateModality() {
    if (!profile) {
      return;
    }

    const slug = createModalitySlugDraft.trim() || slugify(createModalityNameDraft);
    const playersPerTeam = Number(createModalityPlayersDraft);
    const positions = parsePositions(createModalityPositionsDraft);

    if (
      !createModalityNameDraft.trim() ||
      !slug ||
      !Number.isInteger(playersPerTeam) ||
      playersPerTeam <= 0 ||
      positions.length === 0
    ) {
      setMessage({ tone: "error", text: "Revise os dados da modalidade esportiva." });
      return;
    }

    setIsCreatingModality(true);
    setMessage(null);

    try {
      const createdModality = await createSportModality({
        createdBy: profile.id,
        name: createModalityNameDraft.trim(),
        slug,
        playersPerTeam,
        positions,
      });

      await reloadModalities();
      setCreateModalityId(createdModality.id);
      setCreateModalityNameDraft("");
      setCreateModalitySlugDraft("");
      setCreateModalityPlayersDraft("5");
      setCreateModalityPositionsDraft("Goleiro, Zagueiro, Ala, Meio-campo, Atacante");
      setMessage({ tone: "success", text: "Modalidade esportiva cadastrada." });
    } catch (createError) {
      setMessage({ tone: "error", text: getReadableError(createError) });
    } finally {
      setIsCreatingModality(false);
    }
  }

  async function handleLinkMember() {
    if (!selectedAccess || !overview) {
      return;
    }

    const normalizedEmail = memberEmailDraft.trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setMessage({ tone: "error", text: "Informe um email valido para vinculo." });
      return;
    }

    if (memberRoleDraft === "player" && !memberPriorityGroupId) {
      setMessage({
        tone: "error",
        text: "Selecione o grupo prioritario do jogador antes de salvar.",
      });
      return;
    }

    setIsLinkingMember(true);
    setMessage(null);

    try {
      const linkedProfile = await findProfileByEmail(normalizedEmail);

      if (!linkedProfile) {
        setMessage({
          tone: "error",
          text: "Esse email ainda nao tem perfil. O usuario precisa entrar no app uma vez antes do vinculo.",
        });
        return;
      }

      await upsertAccountMembership({
        accountId: selectedAccess.account.id,
        profileId: linkedProfile.id,
        role: memberRoleDraft,
        priorityGroupId: memberRoleDraft === "player" ? memberPriorityGroupId : null,
      });

      setOverview(await getAccountOverview(selectedAccess.account.id));
      await refresh();
      setMemberEmailDraft("");
      setMemberRoleDraft("player");
      setMessage({
        tone: "success",
        text: `${linkedProfile.full_name || linkedProfile.email} vinculado a ${selectedAccess.account.name}.`,
      });
    } catch (linkError) {
      setMessage({ tone: "error", text: getReadableError(linkError) });
    } finally {
      setIsLinkingMember(false);
    }
  }

  const canManageAccount = Boolean(
    profile?.is_super_admin || selectedMembership?.membership.role === "group_admin",
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Conta conectada</Text>
        <Text style={styles.heroTitle}>{profile?.full_name || "Usuario autenticado"}</Text>
        <Text style={styles.heroSubtitle}>
          {profile?.is_super_admin
            ? "Perfil global habilitado para criar e administrar contas esportivas."
            : "Perfil autenticado para acessar a conta esportiva vinculada."}
        </Text>
        <View style={styles.heroRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{availableAccounts.length}</Text>
            <Text style={styles.heroStatLabel}>
              {profile?.is_super_admin ? "Contas visiveis" : "Contas vinculadas"}
            </Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{profile?.email ?? "Sem email"}</Text>
            <Text style={styles.heroStatLabel}>Email atual</Text>
          </View>
        </View>
      </View>

      {profile?.is_super_admin ? (
        <>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Cadastrar modalidade esportiva</Text>
            <Text style={styles.panelText}>
              Defina a modalidade base e as posicoes que poderao ser escolhidas nos perfis.
            </Text>

            <TextInput
              value={createModalityNameDraft}
              onChangeText={setCreateModalityNameDraft}
              placeholder="Nome da modalidade"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
            />
            <TextInput
              value={createModalitySlugDraft}
              onChangeText={(value) => setCreateModalitySlugDraft(slugify(value))}
              placeholder="futebol-society"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
              autoCapitalize="none"
            />
            <TextInput
              value={createModalityPlayersDraft}
              onChangeText={setCreateModalityPlayersDraft}
              placeholder="Jogadores por equipe"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              style={styles.input}
            />
            <TextInput
              value={createModalityPositionsDraft}
              onChangeText={setCreateModalityPositionsDraft}
              placeholder="Goleiro, Zagueiro, Ala, Atacante"
              placeholderTextColor={Colors.textMuted}
              style={[styles.input, styles.multiline]}
              multiline
            />

            <Pressable
              onPress={() => void handleCreateModality()}
              disabled={isCreatingModality || isAdminLoading}
              style={[
                styles.primaryButton,
                (isCreatingModality || isAdminLoading) && styles.buttonDisabled,
              ]}>
              {isCreatingModality ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Cadastrar modalidade</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Criar conta esportiva</Text>
            <Text style={styles.panelText}>
              Crie a conta primeiro. Depois associe os outros usuarios a ela.
            </Text>

            <TextInput
              value={createNameDraft}
              onChangeText={setCreateNameDraft}
              placeholder="Nome da conta"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
            />
            <TextInput
              value={createSlugDraft}
              onChangeText={(value) => setCreateSlugDraft(slugify(value))}
              placeholder="slug-da-conta"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
              autoCapitalize="none"
            />

            <Text style={styles.label}>Modalidade</Text>
            <View style={styles.chips}>
              {modalities.map((modality) => (
                <Pressable
                  key={modality.id}
                  onPress={() => setCreateModalityId(modality.id)}
                  style={[
                    styles.chip,
                    createModalityId === modality.id && styles.chipSelected,
                  ]}>
                  <Text
                    style={[
                      styles.chipText,
                      createModalityId === modality.id && styles.chipTextSelected,
                    ]}>
                    {modality.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Dia da semana</Text>
            <View style={styles.chips}>
              {weekdayLabels.map((weekday, index) => (
                <Pressable
                  key={weekday}
                  onPress={() => setCreateWeekday(String(index))}
                  style={[
                    styles.chip,
                    createWeekday === String(index) && styles.chipSelected,
                  ]}>
                  <Text
                    style={[
                      styles.chipText,
                      createWeekday === String(index) && styles.chipTextSelected,
                    ]}>
                    {weekday}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.row}>
              <TextInput
                value={createStartsAt}
                onChangeText={setCreateStartsAt}
                placeholder="20:30"
                placeholderTextColor={Colors.textMuted}
                style={[styles.input, styles.flex]}
              />
              <TextInput
                value={createEndsAt}
                onChangeText={setCreateEndsAt}
                placeholder="22:00"
                placeholderTextColor={Colors.textMuted}
                style={[styles.input, styles.flex]}
              />
            </View>

            <View style={styles.row}>
              <TextInput
                value={createMaxPlayers}
                onChangeText={setCreateMaxPlayers}
                placeholder="Maximo"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                style={[styles.input, styles.flex]}
              />
              <TextInput
                value={createOpenHours}
                onChangeText={setCreateOpenHours}
                placeholder="Abre (h)"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                style={[styles.input, styles.flex]}
              />
              <TextInput
                value={createCloseMinutes}
                onChangeText={setCreateCloseMinutes}
                placeholder="Fecha (min)"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
                style={[styles.input, styles.flex]}
              />
            </View>

            <TextInput
              value={createPriorityGroups}
              onChangeText={setCreatePriorityGroups}
              placeholder="Prioridade 1, Prioridade 2, Lista geral"
              placeholderTextColor={Colors.textMuted}
              style={[styles.input, styles.multiline]}
              multiline
            />

            <Pressable
              onPress={() => void handleCreateAccount()}
              disabled={isCreatingAccount || isAdminLoading}
              style={[
                styles.primaryButton,
                (isCreatingAccount || isAdminLoading) && styles.buttonDisabled,
              ]}>
              {isCreatingAccount ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Criar conta esportiva</Text>
              )}
            </Pressable>
          </View>
        </>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {profile?.is_super_admin ? "Contas esportivas" : "Vinculos do usuario"}
        </Text>
        <Pressable onPress={() => void signOut()} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Sair</Text>
        </Pressable>
      </View>

      {availableAccounts.length > 0 ? (
        availableAccounts.map((item) => (
          <Pressable
            key={item.account.id}
            onPress={() => setSelectedAccountId(item.account.id)}
            style={[
              styles.panel,
              selectedAccountId === item.account.id && styles.panelSelected,
            ]}>
            <Text style={styles.panelTitle}>{item.account.name}</Text>
            <Text style={styles.panelText}>{item.roleLabel}</Text>
            <Text style={styles.panelText}>
              Grupo prioritario: {item.priorityGroupName ?? "Nao definido"}
            </Text>
          </Pressable>
        ))
      ) : (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>
            {profile?.is_super_admin
              ? "Nenhuma conta esportiva cadastrada ainda"
              : "Nenhuma conta vinculada ainda"}
          </Text>
          <Text style={styles.panelText}>
            {profile?.is_super_admin
              ? "Use o formulario acima para cadastrar a primeira conta esportiva."
              : "Depois do cadastro da conta, vincule este usuario em account_memberships."}
          </Text>
        </View>
      )}

      {selectedAccess ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conta ativa</Text>

          {isOverviewLoading && !overview ? (
            <View style={styles.panel}>
              <ActivityIndicator color={Colors.tint} />
              <Text style={styles.panelText}>Carregando configuracao da conta...</Text>
            </View>
          ) : null}

          {overview ? (
            <>
              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{overview.modality.name}</Text>
                  <Text style={styles.summaryLabel}>Modalidade</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{overview.account.max_players_per_event}</Text>
                  <Text style={styles.summaryLabel}>Limite por evento</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{overview.activeMemberCount}</Text>
                  <Text style={styles.summaryLabel}>Membros ativos</Text>
                </View>
              </View>

              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Horario semanal</Text>
                {overview.schedules.map((schedule) => (
                  <Text key={schedule.id} style={styles.panelText}>
                    {formatSchedule(schedule.weekday, schedule.starts_at, schedule.ends_at)}
                  </Text>
                ))}
              </View>

              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Grupos prioritarios</Text>
                <View style={styles.chips}>
                  {overview.priorityGroups.map((group) => (
                    <View key={group.id} style={styles.tag}>
                      <Text style={styles.tagText}>
                        {group.priority_rank}. {group.name}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {profile?.is_super_admin ? (
                <View style={styles.panel}>
                  <Text style={styles.panelTitle}>Vincular usuario a esta conta</Text>
                  <Text style={styles.panelText}>
                    Use um email que ja tenha entrado no app ao menos uma vez.
                  </Text>

                  <TextInput
                    value={memberEmailDraft}
                    onChangeText={setMemberEmailDraft}
                    placeholder="email@exemplo.com"
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={styles.input}
                  />

                  <Text style={styles.label}>Papel na conta</Text>
                  <View style={styles.chips}>
                    {(Object.entries(roleLabels) as [AccountRole, string][]).map(([role, label]) => (
                      <Pressable
                        key={role}
                        onPress={() => setMemberRoleDraft(role)}
                        style={[
                          styles.chip,
                          memberRoleDraft === role && styles.chipSelected,
                        ]}>
                        <Text
                          style={[
                            styles.chipText,
                            memberRoleDraft === role && styles.chipTextSelected,
                          ]}>
                          {label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {memberRoleDraft === "player" ? (
                    <>
                      <Text style={styles.label}>Grupo prioritario</Text>
                      <View style={styles.chips}>
                        {overview.priorityGroups.map((group) => (
                          <Pressable
                            key={group.id}
                            onPress={() => setMemberPriorityGroupId(group.id)}
                            style={[
                              styles.chip,
                              memberPriorityGroupId === group.id && styles.chipSelected,
                            ]}>
                            <Text
                              style={[
                                styles.chipText,
                                memberPriorityGroupId === group.id && styles.chipTextSelected,
                              ]}>
                              {group.name}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  ) : null}

                  <Pressable
                    onPress={() => void handleLinkMember()}
                    disabled={isLinkingMember}
                    style={[styles.primaryButton, isLinkingMember && styles.buttonDisabled]}>
                    {isLinkingMember ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Vincular usuario</Text>
                    )}
                  </Pressable>
                </View>
              ) : null}

              {canManageAccount ? (
                <View style={styles.panel}>
                  <Text style={styles.panelTitle}>Editar conta esportiva</Text>
                  <TextInput
                    value={accountNameDraft}
                    onChangeText={setAccountNameDraft}
                    style={styles.input}
                  />
                  <View style={styles.row}>
                    <TextInput
                      value={maxPlayersDraft}
                      onChangeText={setMaxPlayersDraft}
                      keyboardType="number-pad"
                      style={[styles.input, styles.flex]}
                    />
                    <TextInput
                      value={openHoursDraft}
                      onChangeText={setOpenHoursDraft}
                      keyboardType="number-pad"
                      style={[styles.input, styles.flex]}
                    />
                    <TextInput
                      value={closeMinutesDraft}
                      onChangeText={setCloseMinutesDraft}
                      keyboardType="number-pad"
                      style={[styles.input, styles.flex]}
                    />
                  </View>
                  <Pressable
                    onPress={() => void handleSaveAccount()}
                    disabled={isSavingAccount}
                    style={[styles.primaryButton, isSavingAccount && styles.buttonDisabled]}>
                    {isSavingAccount ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Salvar configuracao</Text>
                    )}
                  </Pressable>
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}

      {error || overviewError || message ? (
        <View
          style={[
            styles.messageCard,
            message?.tone === "success" ? styles.messageSuccess : styles.messageError,
          ]}>
          <Text
            style={[
              styles.messageText,
              message?.tone === "success" ? styles.messageTextSuccess : styles.messageTextError,
            ]}>
            {message?.text ?? error ?? overviewError}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 32, gap: 16 },
  hero: {
    borderRadius: 28,
    backgroundColor: Colors.surfaceStrong,
    padding: 24,
    gap: 12,
  },
  kicker: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  heroTitle: { color: "#f8fbf5", fontSize: 28, fontWeight: "900", lineHeight: 34 },
  heroSubtitle: { color: "#d7e5da", fontSize: 15, lineHeight: 22 },
  heroRow: { flexDirection: "row", gap: 12 },
  heroStat: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 14,
    gap: 4,
  },
  heroStatValue: { color: "#ffffff", fontSize: 16, fontWeight: "800" },
  heroStatLabel: { color: "#c6d4c9", fontSize: 12, fontWeight: "700" },
  section: { gap: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { color: Colors.text, fontSize: 18, fontWeight: "800" },
  panel: {
    borderRadius: 24,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 10,
  },
  panelSelected: { borderColor: Colors.tint, backgroundColor: "#f3f9ef" },
  panelTitle: { color: Colors.text, fontSize: 16, fontWeight: "800" },
  panelText: { color: Colors.textMuted, fontSize: 14, lineHeight: 21 },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    color: Colors.text,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  multiline: { minHeight: 84, textAlignVertical: "top" },
  label: { color: Colors.text, fontSize: 13, fontWeight: "800" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 999,
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipSelected: { backgroundColor: Colors.tint },
  chipText: { color: Colors.tint, fontSize: 12, fontWeight: "800" },
  chipTextSelected: { color: "#ffffff" },
  row: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
  primaryButton: {
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: Colors.tint,
    paddingVertical: 14,
  },
  primaryButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  secondaryButton: {
    borderRadius: 999,
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: { color: Colors.text, fontSize: 12, fontWeight: "800" },
  buttonDisabled: { opacity: 0.7 },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  summaryCard: {
    minWidth: "30%",
    flexGrow: 1,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 6,
  },
  summaryValue: { color: Colors.text, fontSize: 20, fontWeight: "900" },
  summaryLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  tag: {
    borderRadius: 999,
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tagText: { color: Colors.tint, fontSize: 12, fontWeight: "800" },
  messageCard: { borderRadius: 16, padding: 14 },
  messageError: { backgroundColor: "#fff2e6" },
  messageSuccess: { backgroundColor: "#e8f6ea" },
  messageText: { fontSize: 13, lineHeight: 20 },
  messageTextError: { color: "#8f4f00" },
  messageTextSuccess: { color: "#1f6b37" },
});
