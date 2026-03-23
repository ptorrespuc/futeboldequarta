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
  listAccountRoster,
  listModalityPositions,
  replaceMembershipPositionPreferences,
  updateProfileBasics,
  type RosterMember,
} from "@/src/lib/accounts";
import { useAuth } from "@/src/providers/auth-provider";
import type { AccountRole, ModalityPosition } from "@/src/types/domain";

const roleLabels: Record<AccountRole, string> = {
  group_admin: "Admin do grupo",
  group_moderator: "Moderador do grupo",
  player: "Jogador",
};

function getReadableError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Nao foi possivel carregar o elenco.";
}

export default function ElencoScreen() {
  const { profile, memberships, refresh } = useAuth();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [availablePositions, setAvailablePositions] = useState<ModalityPosition[]>([]);
  const [fullNameDraft, setFullNameDraft] = useState("");
  const [selectedPositionIds, setSelectedPositionIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

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

    async function loadRoster() {
      if (!selectedMembership) {
        setRoster([]);
        setAvailablePositions([]);
        setStatusMessage(null);
        return;
      }

      setIsLoading(true);
      setStatusMessage(null);

      try {
        const [nextRoster, nextPositions] = await Promise.all([
          listAccountRoster(selectedMembership.account.id, selectedMembership.account.modality_id),
          listModalityPositions(selectedMembership.account.modality_id),
        ]);

        if (!isActive) {
          return;
        }

        setRoster(nextRoster);
        setAvailablePositions(nextPositions);
      } catch (loadError) {
        if (!isActive) {
          return;
        }

        setRoster([]);
        setAvailablePositions([]);
        setStatusMessage({
          tone: "error",
          text: getReadableError(loadError),
        });
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadRoster();

    return () => {
      isActive = false;
    };
  }, [selectedMembership]);

  const currentRosterMember =
    roster.find((member) => member.membership.profile_id === profile?.id) ?? null;

  useEffect(() => {
    setFullNameDraft(currentRosterMember?.profile.full_name ?? profile?.full_name ?? "");
    setSelectedPositionIds(currentRosterMember?.preferredPositions.map((position) => position.id) ?? []);
  }, [currentRosterMember, profile?.full_name]);

  function addPosition(positionId: string) {
    setSelectedPositionIds((current) =>
      current.includes(positionId) ? current : [...current, positionId],
    );
  }

  function removePosition(positionId: string) {
    setSelectedPositionIds((current) => current.filter((value) => value !== positionId));
  }

  async function handleSave() {
    if (!profile || !selectedMembership) {
      return;
    }

    if (!fullNameDraft.trim()) {
      setStatusMessage({
        tone: "error",
        text: "Informe o nome do jogador antes de salvar.",
      });
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    try {
      await updateProfileBasics({
        profileId: profile.id,
        fullName: fullNameDraft.trim(),
      });

      await replaceMembershipPositionPreferences(
        selectedMembership.membership.id,
        selectedPositionIds,
      );

      const [nextRoster, nextPositions] = await Promise.all([
        listAccountRoster(selectedMembership.account.id, selectedMembership.account.modality_id),
        listModalityPositions(selectedMembership.account.modality_id),
      ]);

      setRoster(nextRoster);
      setAvailablePositions(nextPositions);
      await refresh();
      setStatusMessage({
        tone: "success",
        text: "Cadastro do jogador atualizado.",
      });
    } catch (saveError) {
      setStatusMessage({
        tone: "error",
        text: getReadableError(saveError),
      });
    } finally {
      setIsSaving(false);
    }
  }

  const adminsAndModerators = roster.filter(
    (member) => member.membership.role !== "player",
  ).length;
  const withoutPreferences = roster.filter((member) => member.preferredPositions.length === 0).length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Elenco e cadastro do jogador</Text>
        <Text style={styles.subtitle}>
          Esta etapa troca o mock por memberships reais e libera a edicao do proprio nome e das
          posicoes favoritas em ordem de preferencia.
        </Text>
      </View>

      {memberships.length > 1 ? (
        <View style={styles.accountSwitcher}>
          {memberships.map((item) => {
            const isSelected = item.account.id === selectedMembership?.account.id;

            return (
              <Pressable
                key={item.membership.id}
                onPress={() => setSelectedAccountId(item.account.id)}
                style={[styles.accountChip, isSelected && styles.accountChipSelected]}>
                <Text style={[styles.accountChipText, isSelected && styles.accountChipTextSelected]}>
                  {item.account.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {!selectedMembership ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Sem membership para montar o elenco</Text>
          <Text style={styles.emptyText}>
            Associe este perfil em `account_memberships` para testar o cadastro do jogador e a
            visualizacao do grupo.
          </Text>
        </View>
      ) : null}

      {selectedMembership ? (
        <>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{roster.length}</Text>
              <Text style={styles.summaryLabel}>Membros ativos</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{adminsAndModerators}</Text>
              <Text style={styles.summaryLabel}>Admins e moderadores</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{withoutPreferences}</Text>
              <Text style={styles.summaryLabel}>Sem preferencias</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Meu cadastro no grupo</Text>
            <Text style={styles.cardText}>
              O grupo prioritario continua somente leitura para o jogador, como definido no modelo
              de dados.
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Nome</Text>
              <TextInput
                onChangeText={setFullNameDraft}
                style={styles.input}
                value={fullNameDraft}
              />
            </View>

            <View style={styles.readOnlyGrid}>
              <View style={styles.readOnlyCard}>
                <Text style={styles.readOnlyLabel}>Email</Text>
                <Text style={styles.readOnlyValue}>{profile?.email ?? "Sem email"}</Text>
              </View>
              <View style={styles.readOnlyCard}>
                <Text style={styles.readOnlyLabel}>Papel</Text>
                <Text style={styles.readOnlyValue}>{roleLabels[selectedMembership.membership.role]}</Text>
              </View>
              <View style={styles.readOnlyCard}>
                <Text style={styles.readOnlyLabel}>Grupo prioritario</Text>
                <Text style={styles.readOnlyValue}>
                  {selectedMembership.priorityGroup?.name ?? "Nao definido"}
                </Text>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Posicoes favoritas em ordem</Text>
              <Text style={styles.helperText}>
                Toque nas posicoes abaixo para adicionar. Toque em uma escolhida para remover e
                reordenar automaticamente.
              </Text>

              <View style={styles.inlineWrap}>
                {selectedPositionIds.length > 0 ? (
                  selectedPositionIds.map((positionId, index) => {
                    const position = availablePositions.find((item) => item.id === positionId);

                    if (!position) {
                      return null;
                    }

                    return (
                      <Pressable
                        key={position.id}
                        onPress={() => removePosition(position.id)}
                        style={styles.selectedChip}>
                        <Text style={styles.selectedChipText}>
                          {index + 1}. {position.name}
                        </Text>
                      </Pressable>
                    );
                  })
                ) : (
                  <Text style={styles.emptyPreferenceText}>
                    Nenhuma posicao favorita cadastrada ainda.
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Posicoes disponiveis</Text>
              <View style={styles.inlineWrap}>
                {availablePositions.map((position) => {
                  const isSelected = selectedPositionIds.includes(position.id);

                  return (
                    <Pressable
                      key={position.id}
                      disabled={isSelected}
                      onPress={() => addPosition(position.id)}
                      style={[
                        styles.positionChip,
                        isSelected && styles.positionChipSelected,
                      ]}>
                      <Text
                        style={[
                          styles.positionChipText,
                          isSelected && styles.positionChipTextSelected,
                        ]}>
                        {position.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Pressable
              disabled={isSaving}
              onPress={() => void handleSave()}
              style={[styles.primaryButton, isSaving && styles.primaryButtonDisabled]}>
              {isSaving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Salvar meu cadastro</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Elenco ativo da conta</Text>

            {isLoading && roster.length === 0 ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator color={Colors.tint} />
                <Text style={styles.loadingText}>Carregando memberships e perfis...</Text>
              </View>
            ) : null}

            {roster.length > 0 ? (
              roster.map((member) => (
                <View key={member.membership.id} style={styles.playerCard}>
                  <View style={styles.rowBetween}>
                    <View style={styles.playerIdentity}>
                      <Text style={styles.playerName}>{member.profile.full_name}</Text>
                      <Text style={styles.playerMeta}>{member.profile.email}</Text>
                    </View>
                    <View style={styles.roleTag}>
                      <Text style={styles.roleTagText}>{roleLabels[member.membership.role]}</Text>
                    </View>
                  </View>

                  <View style={styles.inlineWrap}>
                    <View style={styles.secondaryTag}>
                      <Text style={styles.secondaryTagText}>
                        {member.priorityGroup?.name ?? "Sem grupo prioritario"}
                      </Text>
                    </View>
                    <View style={styles.secondaryTag}>
                      <Text style={styles.secondaryTagText}>
                        {member.preferredPositions.length > 0
                          ? member.preferredPositions.map((position) => position.name).join(" • ")
                          : "Sem posicoes favoritas"}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            ) : !isLoading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Nenhum jogador vinculado ainda</Text>
                <Text style={styles.emptyText}>
                  Depois do primeiro `account_membership`, esta lista passa a refletir o elenco
                  real da conta.
                </Text>
              </View>
            ) : null}
          </View>
        </>
      ) : null}

      {statusMessage ? (
        <View
          style={[
            styles.messageCard,
            statusMessage.tone === "error" ? styles.messageCardError : styles.messageCardSuccess,
          ]}>
          <Text
            style={[
              styles.messageText,
              statusMessage.tone === "error" ? styles.messageTextError : styles.messageTextSuccess,
            ]}>
            {statusMessage.text}
          </Text>
        </View>
      ) : null}
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
  header: {
    gap: 8,
  },
  title: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  accountSwitcher: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  accountChip: {
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  accountChipSelected: {
    borderColor: Colors.tint,
    backgroundColor: "#f3f9ef",
  },
  accountChipText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  accountChipTextSelected: {
    color: Colors.tint,
  },
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  summaryCard: {
    minWidth: "30%",
    flexGrow: 1,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 6,
  },
  summaryValue: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: "900",
  },
  summaryLabel: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
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
    fontSize: 18,
    fontWeight: "800",
  },
  cardText: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  field: {
    gap: 8,
  },
  label: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  helperText: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
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
  readOnlyGrid: {
    gap: 10,
  },
  readOnlyCard: {
    borderRadius: 16,
    backgroundColor: Colors.background,
    padding: 14,
    gap: 4,
  },
  readOnlyLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  readOnlyValue: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  inlineWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  selectedChip: {
    borderRadius: 999,
    backgroundColor: Colors.tint,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectedChipText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  emptyPreferenceText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  positionChip: {
    borderRadius: 999,
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  positionChipSelected: {
    backgroundColor: "#e0efe0",
  },
  positionChipText: {
    color: Colors.tint,
    fontSize: 12,
    fontWeight: "800",
  },
  positionChipTextSelected: {
    color: Colors.textMuted,
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
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  loadingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 22,
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
  playerCard: {
    width: "100%",
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 10,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  playerIdentity: {
    flex: 1,
    gap: 4,
  },
  playerName: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  playerMeta: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  roleTag: {
    borderRadius: 999,
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  roleTagText: {
    color: Colors.tint,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  secondaryTag: {
    borderRadius: 999,
    backgroundColor: Colors.background,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  secondaryTagText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  emptyState: {
    borderRadius: 22,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 6,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  messageCard: {
    borderRadius: 18,
    padding: 14,
  },
  messageCardError: {
    backgroundColor: "#fff2e6",
  },
  messageCardSuccess: {
    backgroundColor: "#e8f6ea",
  },
  messageText: {
    fontSize: 13,
    lineHeight: 20,
  },
  messageTextError: {
    color: "#8f4f00",
  },
  messageTextSuccess: {
    color: "#1f6b37",
  },
});
