import { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";

function LegalNavLink({
  label,
  href,
}: {
  label: string;
  href: "/privacy" | "/terms" | "/contact" | "/refund";
}) {
  return (
    <Pressable
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.navChip, pressed && styles.navChipPressed]}
    >
      <Text style={styles.navChipText}>{label}</Text>
    </Pressable>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export default function LegalPageLayout({
  eyebrow,
  title,
  summary,
  children,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={Colors.white} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.summary}>{summary}</Text>
          </View>
        </View>

        <View style={styles.navRow}>
          <LegalNavLink label="Privacy" href="/privacy" />
          <LegalNavLink label="Terms" href="/terms" />
          <LegalNavLink label="Contact" href="/contact" />
          <LegalNavLink label="Refunds" href="/refund" />
        </View>

        <View style={styles.card}>{children}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  header: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  backButton: {
    paddingTop: 6,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: Colors.accent,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    fontFamily: "PlayfairDisplay_700Bold",
    fontSize: 30,
    color: Colors.white,
    marginBottom: 8,
  },
  summary: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  navRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  navChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.surfaceLight,
  },
  navChipPressed: {
    opacity: 0.85,
  },
  navChipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: Colors.white,
  },
  card: {
    borderRadius: 18,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 18,
    gap: 18,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: Colors.white,
  },
  sectionBody: {
    gap: 8,
  },
});
