import { Text, StyleSheet } from "react-native";
import LegalPageLayout, { LegalSection } from "@/components/LegalPageLayout";
import Colors from "@/constants/colors";

export default function RefundScreen() {
  return (
    <LegalPageLayout
      eyebrow="Billing"
      title="Refunds and Cancellation"
      summary="How cancellations, subscription management, and refund handling work across Apple, Google Play, and web checkout."
    >
      <LegalSection title="Subscription Cancellation">
        <Text style={styles.bodyText}>
          Subscriptions must be canceled through the same platform used to purchase them. Apple subscriptions are
          managed through Apple, Google Play subscriptions through Google Play, and web subscriptions through the
          relevant Stripe checkout or billing flow.
        </Text>
      </LegalSection>

      <LegalSection title="Refund Handling">
        <Text style={styles.bodyText}>
          Refund eligibility depends on the purchase platform and applicable consumer law. Apple and Google Play handle
          their own refund workflows. Web purchases may be reviewed case by case through billing support.
        </Text>
        <Text style={styles.bodyText}>
          If a payment is refunded or charged back, related credits or benefits may be reversed.
        </Text>
      </LegalSection>

      <LegalSection title="Credit Packs">
        <Text style={styles.bodyText}>
          Credit packs unlock digital features and are generally treated as consumed digital goods once delivered,
          except where a refund is required by platform policy or law.
        </Text>
      </LegalSection>

      <LegalSection title="Support Contact">
        <Text style={styles.bodyText}>
          Billing questions and cancellation requests: billing@thestylist.app
        </Text>
        <Text style={styles.bodyText}>
          Please include the platform used for purchase, account email, and transaction details where available.
        </Text>
      </LegalSection>
    </LegalPageLayout>
  );
}

const styles = StyleSheet.create({
  bodyText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
});
