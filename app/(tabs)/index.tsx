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
  getAccountOverview,
  updateSportsAccountBasics,
  type AccountOverview,
} from "@/src/lib/accounts";
import { useAuth } from "@/src/providers/auth-provider";
import type { AccountRole } from "@/src/types/domain";

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

function getReadableError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Nao foi possivel carregar os dados da conta.";
}

function formatSchedule(weekday: number, startsAt: string, endsAt: string) {
  return `${weekdayLabels[weekday] ?? "Dia"} • ${startsAt.slice(0, 5)} às ${endsAt.slice(0, 5)}`;
}

function formatBooleanLabel(value: boolean) {
  return value ? "Ativo" : "Desligado";
}

export default function TabOneScreen() {
  const { profile, memberships, error, signOut, refresh } = useAuth();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [isOverviewLoading, setIsOverviewLoading] = useState(false);
  const [accountNameDraft, setAccountNameDraft] = useState("");
  const [maxPlayersDraft, setMaxPlayersDraft] = useState("");
  const [openHoursDraft, setOpenHoursDraft] = useState("");
  const [closeMinutesDraft, setCloseMinutesDraft] = useState("");
  const [isSavingAccount, setIsSavingAccount] = useState(false);

  useEffect(() => {
    if (memberships.length === 0) {
      setSelectedAccountId(null);
      return;
    }

    const accountStillExists = memberships.some((item) => item.account.id === selectedAccountId);

    if (!selectedAccountId || !accountStillExists) {
      setSelectedAccountId(memberships[0].account.id);
    }
  }, [memberships, selectedAccountId]);

  const selectedMembership =
    memberships.find((item) => item.account.id === selectedAccountId) ?? memberships[0] ?? null;

  useEffect(() => {
    let isActive = true;

    async function loadOverview() {
      if (!selectedMembership) {
        setOverview(null);
        setOverviewError(null);
        return;
      }

      setIsOverviewLoading(true);
      setOverviewError(null);

      try {
        const nextOverview = await getAccountOverview(selectedMembership.account.id);

        if (!isActive) {
          return;
        }

        setOverview(nextOverview);
      } catch (loadError) {
        if (!isActive) {
          return;
        }

        setOverview(null);
        setOverviewError(getReadableError(loadError));
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
  }, [selectedMembership]);

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

  async function handleSaveAccount() {
    if (!overview) {
      return;
    }

    const maxPlayersPerEvent = Number(maxPlayersDraft);
    const confirmationOpenHoursBefore = Number(openHoursDraft);
    const confirmationCloseMinutesBefore = Number(closeMinutesDraft);

    if (!accountNameDraft.trim()) {
      setOverviewError("Informe o nome da conta.");
      return;
    }

    if (
      !Number.isInteger(maxPlayersPerEvent) ||
      maxPlayersPerEvent <= 0 ||
      !Number.isInteger(confirmationOpenHoursBefore) ||
      confirmationOpenHoursBefore < 0 ||
      !Number.isInteger(confirmationCloseMinutesBefore) ||
      confirmationCloseMinutesBefore < 0
    ) {
      setOverviewError("Revise os campos numericos da configuracao da conta.");
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

      const nextOverview = await getAccountOverview(overview.account.id);
      setOverview(nextOverview);
      await refresh();
    } catch (saveError) {
      setOverviewError(getReadableError(saveError));
    } finally {
      setIsSavingAccount(false);
    }
  }

  const canManageAccount = Boolean(
    profile?.is_super_admin || selectedMembership?.membership.role === "group_admin",
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroHalo} />
        <Text style={styles.kicker}>Conta conectada</Text>
        <Text style={styles.heroTitle}>{profile?.full_name ?? "Usuario autenticado"}</Text>
        <Text style={styles.heroSubtitle}>
          {profile?.is_super_admin
            ? "Perfil global habilitado para administrar modalidade e conta esportiva."
            : "Perfil autenticado no Supabase, com leitura da conta esportiva e do elenco."}
        </Text>
        <View style={styles.heroFooter}>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillValue}>{memberships.length}</Text>
            <Text style={styles.heroPillLabel}>Contas vinculadas</Text>
          </View>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillValue}>{profile?.email ?? "Sem email"}</Text>
            <Text style={styles.heroPillLabel}>Email atual</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Vinculos do usuario</Text>
          <Pressable onPress={() => void signOut()} style={styles.signOutButton}>
            <Text style={styles.signOutText}>Sair</Text>
          </Pressable>
        </View>

        {memberships.length > 0 ? (
          memberships.map((item) => {
            const isSelected = item.account.id === selectedMembership?.account.id;

            return (
              <Pressable
                key={item.membership.id}
                onPress={() => setSelectedAccountId(item.account.id)}
                style={[styles.membershipCard, isSelected && styles.membershipCardSelected]}>
                <Text style={styles.membershipName}>{item.account.name}</Text>
                <Text style={styles.membershipMeta}>{roleLabels[item.membership.role]}</Text>
                <Text style={styles.membershipMeta}>
                  Grupo prioritario: {item.priorityGroup?.name ?? "Nao definido"}
                </Text>
              </Pressable>
            );
          })
        ) : (
          <View style={styles.membershipEmpty}>
            <Text style={styles.membershipEmptyTitle}>Nenhuma conta vinculada ainda</Text>
            <Text style={styles.membershipEmptyText}>
              O schema e o seed ja estao aplicados. O proximo passo e associar este perfil em
              `account_memberships`.
            </Text>
          </View>
        )}
      </View>

      {selectedMembership ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conta ativa no app</Text>

          {isOverviewLoading && !overview ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={Colors.tint} />
              <Text style={styles.loadingText}>Carregando configuracao da conta...</Text>
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

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Horario padrao</Text>
                {overview.schedules.length > 0 ? (
                  overview.schedules.map((schedule) => (
                    <View key={schedule.id} style={styles.inlineItem}>
                      <Text style={styles.inlineValue}>
                        {formatSchedule(schedule.weekday, schedule.starts_at, schedule.ends_at)}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.cardText}>Ainda nao ha periodicidade semanal cadastrada.</Text>
                )}
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Janela de confirmacao</Text>
                <Text style={styles.cardText}>
                  Abre {overview.account.confirmation_open_hours_before}h antes e fecha{" "}
                  {overview.account.confirmation_close_minutes_before} min antes do evento.
                </Text>
                <Text style={styles.cardTitle}>Notificacoes automaticas</Text>
                <View style={styles.inlineWrap}>
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>
                      Abertura: {formatBooleanLabel(overview.account.auto_notify_confirmation_open)}
                    </Text>
                  </View>
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>
                      Lista de espera: {formatBooleanLabel(overview.account.auto_notify_waitlist_changes)}
                    </Text>
                  </View>
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>
                      Atualizacoes: {formatBooleanLabel(overview.account.auto_notify_event_updates)}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Grupos prioritarios</Text>
                <View style={styles.inlineWrap}>
                  {overview.priorityGroups.map((group) => (
                    <View key={group.id} style={styles.priorityGroupCard}>
                      <View
                        style={[
                          styles.prioritySwatch,
                          { backgroundColor: group.color_hex ?? Colors.surfaceMuted },
                        ]}
                      />
                      <Text style={styles.priorityGroupName}>{group.name}</Text>
                      <Text style={styles.priorityGroupMeta}>Ordem {group.priority_rank}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {canManageAccount ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Editar conta esportiva</Text>
                  <Text style={styles.cardText}>
                    Este corte libera a manutencao basica da conta ativa. O cadastro global de
                    modalidades fica para o proximo passo de admin.
                  </Text>

                  <View style={styles.field}>
                    <Text style={styles.label}>Nome da conta</Text>
                    <TextInput
                      onChangeText={setAccountNameDraft}
                      style={styles.input}
                      value={accountNameDraft}
                    />
                  </View>

                  <View style={styles.fieldRow}>
                    <View style={styles.fieldColumn}>
                      <Text style={styles.label}>Limite por evento</Text>
                      <TextInput
                        keyboardType="number-pad"
                        onChangeText={setMaxPlayersDraft}
                        style={styles.input}
                        value={maxPlayersDraft}
                      />
                    </View>

                    <View style={styles.fieldColumn}>
                      <Text style={styles.label}>Abre com antecedencia (h)</Text>
                      <TextInput
                        keyboardType="number-pad"
                        onChangeText={setOpenHoursDraft}
                        style={styles.input}
                        value={openHoursDraft}
                      />
                    </View>
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.label}>Fecha antes do evento (min)</Text>
                    <TextInput
                      keyboardType="number-pad"
                      onChangeText={setCloseMinutesDraft}
                      style={styles.input}
                      value={closeMinutesDraft}
                    />
                  </View>

                  <Pressable
                    disabled={isSavingAccount}
                    onPress={() => void handleSaveAccount()}
                    style={[styles.primaryButton, isSavingAccount && styles.primaryButtonDisabled]}>
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

      {error || overviewError ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Pendencia de setup</Text>
          <Text style={styles.errorText}>{error ?? overviewError}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Proximo corte do produto</Text>
        <Text style={styles.cardText}>
          A tela `Agenda` ainda usa dados mockados. Ela vai migrar para eventos reais no M3,
          junto com confirmacao de presenca e fila por prioridade.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 32,
    gap: 18,
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 28,
    backgroundColor: Colors.surfaceStrong,
    padding: 24,
    gap: 14,
  },
  heroHalo: {
    position: "absolute",
    right: -30,
    top: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(212, 242, 106, 0.22)",
  },
  kicker: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#f8fbf5",
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 36,
  },
  heroSubtitle: {
    color: "#d7e5da",
    fontSize: 15,
    lineHeight: 22,
  },
  heroFooter: {
    flexDirection: "row",
    gap: 12,
  },
  heroPill: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 14,
    gap: 4,
  },
  heroPillValue: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  heroPillLabel: {
    color: "#c6d4c9",
    fontSize: 12,
    fontWeight: "700",
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  signOutButton: {
    borderRadius: 999,
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  signOutText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  membershipCard: {
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 4,
  },
  membershipCardSelected: {
    borderColor: Colors.tint,
    backgroundColor: "#f3f9ef",
  },
  membershipName: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  membershipMeta: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  membershipEmpty: {
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 6,
  },
  membershipEmptyTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  membershipEmptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  loadingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
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
  summaryValue: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  summaryLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  card: {
    borderRadius: 24,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 12,
  },
  cardTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  cardText: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  inlineItem: {
    borderRadius: 16,
    backgroundColor: Colors.background,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inlineValue: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  inlineWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  tag: {
    borderRadius: 999,
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tagText: {
    color: Colors.tint,
    fontSize: 12,
    fontWeight: "800",
  },
  priorityGroupCard: {
    minWidth: 120,
    borderRadius: 16,
    backgroundColor: Colors.background,
    padding: 14,
    gap: 6,
  },
  prioritySwatch: {
    width: 28,
    height: 6,
    borderRadius: 999,
  },
  priorityGroupName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  priorityGroupMeta: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  field: {
    gap: 6,
  },
  fieldRow: {
    flexDirection: "row",
    gap: 12,
  },
  fieldColumn: {
    flex: 1,
    gap: 6,
  },
  label: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
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
  primaryButton: {
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: Colors.tint,
    paddingVertical: 14,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  errorCard: {
    borderRadius: 18,
    backgroundColor: "#fff2e6",
    padding: 14,
    gap: 4,
  },
  errorTitle: {
    color: "#8f4f00",
    fontSize: 14,
    fontWeight: "800",
  },
  errorText: {
    color: "#8f4f00",
    fontSize: 13,
    lineHeight: 20,
  },
});
