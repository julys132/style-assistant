import { Text, StyleSheet } from "react-native";
import LegalPageLayout, { LegalSection } from "@/components/LegalPageLayout";
import Colors from "@/constants/colors";

export default function PrivacyScreen() {
  return (
    <LegalPageLayout
      eyebrow="Legal"
      title="Privacy Policy"
      summary="How The Stylist collects, uses, stores, and protects account, wardrobe, and payment-related data."
    >
      <LegalSection title="Information We Collect">
        <Text style={styles.bodyText}>
          We collect account information such as name, email address, authentication provider, and app preferences.
        </Text>
        <Text style={styles.bodyText}>
          If you use wardrobe or styling features, we may process clothing metadata, uploaded images, saved outfits,
          and styling prompts in order to provide the service.
        </Text>
        <Text style={styles.bodyText}>
          Payment transactions are processed through platform billing providers or Stripe. We do not store full card
          numbers in this application.
        </Text>
      </LegalSection>

      <LegalSection title="How We Use Data">
        <Text style={styles.bodyText}>
          We use your data to create and save outfits, manage credits and subscriptions, support sign-in, and respond
          to support or privacy requests.
        </Text>
        <Text style={styles.bodyText}>
          We may also use service logs and device information to monitor reliability, prevent abuse, and troubleshoot
          payment or account issues.
        </Text>
      </LegalSection>

      <LegalSection title="Data Sharing">
        <Text style={styles.bodyText}>
          We share data only with service providers required to operate the app, such as authentication, payments,
          hosting, analytics, and AI inference providers.
        </Text>
        <Text style={styles.bodyText}>
          We do not sell personal data.
        </Text>
      </LegalSection>

      <LegalSection title="Retention and Security">
        <Text style={styles.bodyText}>
          We retain account and wardrobe data for as long as your account remains active or as needed to comply with
          legal and financial obligations.
        </Text>
        <Text style={styles.bodyText}>
          We use commercially reasonable safeguards, but no online system can guarantee absolute security.
        </Text>
      </LegalSection>

      <LegalSection title="Your Choices">
        <Text style={styles.bodyText}>
          You can update profile information in the app and request account deletion through the Profile screen or by
          contacting privacy@thestylist.app.
        </Text>
        <Text style={styles.bodyText}>
          If your account is deleted, related data will be removed except where retention is required for fraud,
          tax, bookkeeping, or legal compliance.
        </Text>
      </LegalSection>

      <LegalSection title="Contact">
        <Text style={styles.bodyText}>
          Privacy requests: privacy@thestylist.app
        </Text>
        <Text style={styles.bodyText}>
          General support: support@thestylist.app
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
