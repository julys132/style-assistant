import { Text, StyleSheet } from "react-native";
import LegalPageLayout, { LegalSection } from "@/components/LegalPageLayout";
import Colors from "@/constants/colors";

export default function TermsScreen() {
  return (
    <LegalPageLayout
      eyebrow="Legal"
      title="Terms of Service"
      summary="The rules that govern use of The Stylist, including accounts, purchases, subscriptions, and acceptable use."
    >
      <LegalSection title="Use of the Service">
        <Text style={styles.bodyText}>
          The Stylist is provided for personal, non-exclusive use. You agree to use the app lawfully and not to misuse
          the service, interfere with platform operations, or attempt unauthorized access to accounts or infrastructure.
        </Text>
      </LegalSection>

      <LegalSection title="Accounts">
        <Text style={styles.bodyText}>
          You are responsible for the accuracy of your account information and for maintaining the confidentiality of
          your login credentials.
        </Text>
        <Text style={styles.bodyText}>
          We may suspend or terminate accounts involved in fraud, abuse, payment disputes, or violations of these terms.
        </Text>
      </LegalSection>

      <LegalSection title="Credits and Digital Services">
        <Text style={styles.bodyText}>
          Credit packs and subscription benefits unlock digital styling features inside the app. Credits are consumed
          when eligible styling actions are completed.
        </Text>
        <Text style={styles.bodyText}>
          Prices, plan structure, and included benefits may change over time. Changes do not retroactively modify
          already completed purchases unless required by law.
        </Text>
      </LegalSection>

      <LegalSection title="Subscriptions">
        <Text style={styles.bodyText}>
          If you purchase a subscription, it renews according to the billing terms of the payment platform you used,
          unless canceled before the renewal date.
        </Text>
        <Text style={styles.bodyText}>
          Subscription management, cancellation, renewal timing, and billing notices are governed by Apple, Google Play,
          or Stripe depending on where the purchase was made.
        </Text>
      </LegalSection>

      <LegalSection title="Intellectual Property">
        <Text style={styles.bodyText}>
          The app, branding, software, layouts, and service logic remain the property of The Stylist and its licensors.
          You may not copy, resell, reverse engineer, or redistribute the service except as allowed by law.
        </Text>
      </LegalSection>

      <LegalSection title="Disclaimer and Liability">
        <Text style={styles.bodyText}>
          Styling suggestions are provided as informational guidance. We do not guarantee fashion outcomes, fit, or
          commercial suitability of generated recommendations.
        </Text>
        <Text style={styles.bodyText}>
          To the maximum extent permitted by law, the service is provided as available and without warranties of
          uninterrupted operation.
        </Text>
      </LegalSection>

      <LegalSection title="Contact">
        <Text style={styles.bodyText}>
          Terms or legal questions: support@thestylist.app
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
