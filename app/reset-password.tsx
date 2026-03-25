import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import Colors from "@/constants/Colors";
import { useAuth } from "@/src/providers/auth-provider";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { session, isLoading, updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (password.length < 6) {
      setMessage("Use uma senha com pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("As senhas nao conferem.");
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      await updatePassword(password);
      setMessage("Senha atualizada com sucesso. Agora voce ja pode entrar normalmente.");
      setPassword("");
      setConfirmPassword("");
      router.replace("/login");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nao foi possivel atualizar a senha.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading && !session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.tint} />
          <Text style={styles.subtitle}>Validando o link recebido por email...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.page}>
          <View style={styles.card}>
            <Text style={styles.title}>Redefinir senha</Text>
            <Text style={styles.subtitle}>
              Abra novamente o link enviado por email neste aparelho para autorizar a definicao da senha.
            </Text>
            <Pressable onPress={() => router.replace("/login")} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Voltar para login</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.card}>
          <Text style={styles.title}>Nova senha</Text>
          <Text style={styles.subtitle}>
            Defina a senha da sua conta para concluir o acesso ao BoraJogar.
          </Text>

          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Nova senha"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
            style={styles.input}
          />

          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirme a nova senha"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
            style={styles.input}
          />

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Pressable
            onPress={() => void handleSubmit()}
            disabled={isSubmitting}
            style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}>
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>Salvar nova senha</Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  page: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: Colors.background,
  },
  card: {
    borderRadius: 26,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    gap: 14,
  },
  title: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: "900",
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
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
  message: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: Colors.tint,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: Colors.surfaceMuted,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
