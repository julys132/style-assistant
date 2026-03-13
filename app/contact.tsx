import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import LegalPageLayout, { LegalSection } from "@/components/LegalPageLayout";
import Colors from "@/constants/colors";

function ContactRow({
  icon,
  title,
  value,
  href,
}: {
  icon: string;
  title: string;
  value: string;
  href: string;
}) {
  return (
    <Pressable
      onPress={() => Linking.openURL(href)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Ionicons name={icon as never} size={18} color={Colors.accent} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
      <Ionicons name="open-outline" size={16} color={Colors.textMuted} />
    </Pressable>
  );
}

export default function ContactScreen() {
  return (
    <LegalPageLayout
      eyebrow="Support"
      title="Contact"
      summary="Public support and billing contact details for users, store review, privacy requests, and purchase issues."
    >
      <LegalSection title="Support Channels">
        <ContactRow
          icon="mail-outline"
          title="General Support"
          value="support@thestylist.app"
          href="mailto:support@thestylist.app"
        />
        <ContactRow
          icon="card-outline"
          title="Billing Support"
          value="billing@thestylist.app"
          href="mailto:billing@thestylist.app?subject=Billing%20Support"
        />
        <ContactRow
          icon="shield-checkmark-outline"
          title="Privacy Requests"
          value="privacy@thestylist.app"
          href="mailto:privacy@thestylist.app?subject=Privacy%20Request"
        />
      </LegalSection>

      <LegalSection title="What to Include">
        <Text style={styles.bodyText}>
          For faster support, include your account email, platform, purchase method, and a short description of the
          issue.
        </Text>
        <Text style={styles.bodyText}>
          For refund or cancellation questions, use the billing contact and include the purchase date and platform used
          for checkout.
        </Text>
      </LegalSection>
    </LegalPageLayout>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    padding: 14,
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: Colors.white,
  },
  rowValue: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: Colors.textSecondary,
  },
  bodyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
});
