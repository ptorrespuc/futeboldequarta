import { Redirect } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import Colors from "@/constants/Colors";
import { useAuth } from "@/src/providers/auth-provider";

export default function LoginScreen() {
  const { session, signIn, signUp, requestPasswordReset } = useAuth();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (session) {
    return <Redirect href="/" />;
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setMessage(null);

    try {
      if (mode === "sign-in") {
        await signIn(email.trim(), password);
      } else {
        await signUp({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
        });
        setMessage("Conta criada. Confira seu email se o projeto exigir confirmacao antes do primeiro acesso.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel concluir a autenticacao.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setMessage("Informe o email da sua conta para receber o link de redefinicao.");
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      await requestPasswordReset(normalizedEmail);
      setMessage("Enviamos o email de redefinicao. Abra o link neste aparelho para criar a nova senha.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel enviar o email de redefinicao.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.page}>
            <View style={styles.heroCard}>
              <View style={styles.heroGlowLarge} />
              <View style={styles.heroGlowSmall} />

              <Text style={styles.heroKicker}>BoraJogar</Text>
              <Text style={styles.heroTitle}>Organize sua conta esportiva em um so lugar.</Text>
              <Text style={styles.heroSubtitle}>
                Controle jogadores, prioridades, presenca, enquetes e estatisticas do seu grupo com a identidade do
                BoraJogar.
              </Text>

              <View style={styles.heroPills}>
                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText}>Contas esportivas</Text>
                </View>
                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText}>Presenca</Text>
                </View>
                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText}>Prioridades</Text>
                </View>
              </View>
            </View>

            <View style={styles.formCard}>
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>{mode === "sign-in" ? "Entrar no BoraJogar" : "Criar conta no BoraJogar"}</Text>
                <Text style={styles.formSubtitle}>
                  {mode === "sign-in"
                    ? "Use seu email e senha para acessar sua conta esportiva."
                    : "Crie seu acesso para entrar na sua conta esportiva e participar dos eventos."}
                </Text>
              </View>

              <View style={styles.toggleRow}>
                <Pressable
                  onPress={() => setMode("sign-in")}
                  style={[styles.toggleButton, mode === "sign-in" && styles.toggleButtonActive]}>
                  <Text style={[styles.toggleText, mode === "sign-in" && styles.toggleTextActive]}>Entrar</Text>
                </Pressable>
                <Pressable
                  onPress={() => setMode("sign-up")}
                  style={[styles.toggleButton, mode === "sign-up" && styles.toggleButtonActive]}>
                  <Text style={[styles.toggleText, mode === "sign-up" && styles.toggleTextActive]}>Criar conta</Text>
                </Pressable>
              </View>

              {mode === "sign-up" ? (
                <View style={styles.field}>
                  <Text style={styles.label}>Nome completo</Text>
                  <Text style={styles.helper}>Esse nome sera exibido para administradores e participantes.</Text>
                  <TextInput
                    autoCapitalize="words"
                    onChangeText={setFullName}
                    placeholder="Ex.: Pedro Torres"
                    placeholderTextColor={Colors.textMuted}
                    style={styles.input}
                    value={fullName}
                  />
                </View>
              ) : null}

              <View style={styles.field}>
                <Text style={styles.label}>Email</Text>
                <Text style={styles.helper}>Use o mesmo email que sera vinculado a uma conta esportiva.</Text>
                <TextInput
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onChangeText={setEmail}
                  placeholder="voce@exemplo.com"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.input}
                  value={email}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Senha</Text>
                <Text style={styles.helper}>
                  {mode === "sign-in"
                    ? "Digite a senha da sua conta BoraJogar."
                    : "Crie uma senha para usar nos proximos acessos."}
                </Text>
                <TextInput
                  onChangeText={setPassword}
                  placeholder="********"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry
                  style={styles.input}
                  value={password}
                />
              </View>

              {message ? (
                <View style={styles.messageBox}>
                  <Text style={styles.messageText}>{message}</Text>
                </View>
              ) : null}

              <Pressable
                disabled={isSubmitting}
                onPress={() => void handleSubmit()}
                style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}>
                {isSubmitting ? (
                  <ActivityIndicator color="#173728" />
                ) : (
                  <Text style={styles.submitText}>
                    {mode === "sign-in" ? "Entrar na plataforma" : "Criar conta e continuar"}
                  </Text>
                )}
              </Pressable>

              {mode === "sign-in" ? (
                <Pressable disabled={isSubmitting} onPress={() => void handleForgotPassword()}>
                  <Text style={styles.linkText}>Esqueci minha senha</Text>
                </Pressable>
              ) : null}

              <View style={styles.footerBox}>
                <Text style={styles.footerText}>
                  Se voce ainda nao aparece em uma conta esportiva depois do login, um superadmin precisa vincular seu
                  usuario pelo email cadastrado.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  page: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
    gap: 18,
    backgroundColor: Colors.background,
  },
  heroCard: {
    overflow: "hidden",
    borderRadius: 30,
    backgroundColor: Colors.surfaceStrong,
    padding: 24,
    gap: 12,
  },
  heroGlowLarge: {
    position: "absolute",
    right: -42,
    top: -10,
    width: 150,
    height: 150,
    borderRadius: 999,
    backgroundColor: "rgba(212, 242, 106, 0.18)",
  },
  heroGlowSmall: {
    position: "absolute",
    left: -18,
    bottom: -36,
    width: 110,
    height: 110,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  heroKicker: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 36,
    maxWidth: 280,
  },
  heroSubtitle: {
    color: "#d5e2d9",
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 300,
  },
  heroPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  heroPill: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.09)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroPillText: {
    color: "#eff7f1",
    fontSize: 12,
    fontWeight: "800",
  },
  formCard: {
    borderRadius: 28,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    gap: 16,
  },
  formHeader: {
    gap: 6,
  },
  formTitle: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 30,
  },
  formSubtitle: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  toggleRow: {
    flexDirection: "row",
    borderRadius: 16,
    backgroundColor: Colors.surfaceMuted,
    padding: 4,
    gap: 4,
  },
  toggleButton: {
    flex: 1,
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: 10,
  },
  toggleButtonActive: {
    backgroundColor: Colors.surface,
  },
  toggleText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: "800",
  },
  toggleTextActive: {
    color: Colors.text,
  },
  field: {
    gap: 6,
  },
  label: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  helper: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
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
  messageBox: {
    borderRadius: 16,
    backgroundColor: Colors.surfaceMuted,
    padding: 14,
  },
  messageText: {
    color: Colors.text,
    fontSize: 13,
    lineHeight: 20,
  },
  submitButton: {
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: Colors.accent,
    paddingVertical: 15,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: Colors.surfaceStrong,
    fontSize: 14,
    fontWeight: "900",
  },
  linkText: {
    color: Colors.tint,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  footerBox: {
    borderRadius: 18,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  footerText: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
});
