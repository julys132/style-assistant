import React from "react";
import {
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";

const FEATURES = [
  {
    icon: "sparkles-outline",
    title: "AI styling with taste",
    text: "Get polished outfit ideas, refined combinations, and aesthetic guidance that actually looks elevated.",
  },
  {
    icon: "shirt-outline",
    title: "Build looks from your wardrobe",
    text: "Use what you already own and turn random pieces into cohesive, wearable outfits.",
  },
  {
    icon: "color-palette-outline",
    title: "Trend-aware suggestions",
    text: "Create cleaner color combinations, stronger silhouettes, and more intentional styling choices.",
  },
];

const WELCOME_CARD_IMAGES = [
  require("../attached_assets/b_UI_mobile_UX_design_1771664004224.png"),
  require("../attached_assets/b_UI_UX_design_of_a_hi_(1)_1771664004225.png"),
  require("../attached_assets/b_UI_mobile_UX_design_1771664004224.png"),
] as const;

const ART_STYLE_CARDS = [
  {
    title: "Colored Hand-Drawn Sketch",
    text: "Expressive outlines with richer color and a more illustrated finish.",
    source: require("../assets/images/art-styles/colored-hand-drawn-sketch.png"),
  },
  {
    title: "Black-and-White Sketch",
    text: "Clean line work, stronger contrast, and a graphic monochrome mood.",
    source: require("../assets/images/art-styles/hand-drawn-sketch-black-white.png"),
  },
  {
    title: "Simple Watercolor",
    text: "Soft edges, lighter blending, and a more painterly, airy texture.",
    source: require("../assets/images/art-styles/simple-watercolor.png"),
  },
] as const;

export default function WelcomeScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 980;

  return (
    <LinearGradient
      colors={["#07070A", "#111118", "#1A1322"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.page}
    >
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isWide && styles.scrollContentWide,
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.heroSection, isWide && styles.heroSectionWide]}>
            <View style={styles.leftCol}>
              <View style={styles.badge}>
                <Ionicons name="diamond-outline" size={14} color="#F5E7D0" />
                <Text style={styles.badgeText}>Style assistant for modern wardrobes</Text>
              </View>

              <Text style={styles.eyebrow}>PERSONAL STYLING, REIMAGINED</Text>

              <Text style={styles.title}>
                Dress
                <Text style={styles.titleAccent}> smarter</Text>,
                {"\n"}
                look
                <Text style={styles.titleAccent}> expensive</Text>.
              </Text>

              <Text style={styles.subtitle}>
                Discover elevated outfits, cleaner combinations, and trend-aware
                styling suggestions powered by AI - designed to make your wardrobe
                feel curated, not chaotic.
              </Text>

              <View style={styles.ctaRow}>
                <Pressable
                  onPress={() => router.push("/(auth)/login")}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && styles.btnPressed,
                  ]}
                >
                  <LinearGradient
                    colors={["#F5E7D0", "#D9B98C"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.primaryBtnGradient}
                  >
                    <Text style={styles.primaryBtnText}>Get started</Text>
                    <Ionicons name="arrow-forward" size={18} color="#111111" />
                  </LinearGradient>
                </Pressable>

                <Pressable
                  onPress={() => router.push("/(auth)/login")}
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    pressed && styles.btnPressed,
                  ]}
                >
                  <Text style={styles.secondaryBtnText}>I already have an account</Text>
                </Pressable>
              </View>

              <View style={styles.statsRow}>
                <Stat label="Outfit ideas" value="Instant" />
                <Stat label="Style feel" value="Luxury" />
                <Stat label="Workflow" value="Simple" />
              </View>
            </View>

            <View style={styles.rightCol}>
              <View style={styles.visualWrap}>
                <GlowOrb style={styles.orbOne} />
                <GlowOrb style={styles.orbTwo} />
                <FloatingWelcomeCard
                  source={WELCOME_CARD_IMAGES[0]}
                  label="Wardrobe flow"
                  style={styles.floatCardOne}
                />
                <FloatingWelcomeCard
                  source={WELCOME_CARD_IMAGES[1]}
                  label="Editorial preview"
                  style={styles.floatCardTwo}
                />
                <FloatingWelcomeCard
                  source={WELCOME_CARD_IMAGES[2]}
                  label="Look builder"
                  style={styles.floatCardThree}
                />

                <BlurView
                  intensity={Platform.OS === "web" ? 60 : 40}
                  tint="dark"
                  style={styles.heroCard}
                >
                  <Text style={styles.cardOverline}>TODAY&apos;S STYLE DIRECTION</Text>
                  <Text style={styles.heroCardTitle}>Clean. Feminine. Expensive-looking.</Text>

                  <View style={styles.tagRow}>
                    <Tag text="Soft contrast" />
                    <Tag text="Refined basics" />
                    <Tag text="Neutral palette" />
                  </View>

                  <View style={styles.previewPanel}>
                    <View style={styles.previewTop}>
                      <View>
                        <Text style={styles.previewLabel}>Suggested combo</Text>
                        <Text style={styles.previewTitle}>
                          White tee + straight jeans + structured blazer
                        </Text>
                      </View>
                      <View style={styles.previewIconCircle}>
                        <Ionicons name="sparkles" size={18} color="#F3D9B1" />
                      </View>
                    </View>

                    <View style={styles.previewDivider} />

                    <View style={styles.miniCardsRow}>
                      <MiniCard
                        icon="shirt-outline"
                        title="Balance"
                        text="Relaxed + tailored"
                      />
                      <MiniCard
                        icon="color-palette-outline"
                        title="Palette"
                        text="Cream + denim + gold"
                      />
                    </View>
                  </View>
                </BlurView>
              </View>
            </View>
          </View>

          <View style={styles.featuresSection}>
            <Text style={styles.sectionTitle}>Why it feels premium</Text>
            <Text style={styles.sectionSubtitle}>
              Built to help you style faster, cleaner, and with more confidence.
            </Text>

            <View style={[styles.featuresGrid, isWide && styles.featuresGridWide]}>
              {FEATURES.map((feature) => (
                <BlurView
                  key={feature.title}
                  intensity={Platform.OS === "web" ? 50 : 30}
                  tint="dark"
                  style={styles.featureCard}
                >
                  <View style={styles.featureIconWrap}>
                    <Ionicons name={feature.icon as any} size={22} color="#F3D9B1" />
                  </View>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureText}>{feature.text}</Text>
                </BlurView>
              ))}
            </View>
          </View>

          <View style={styles.artStylesSection}>
            <Text style={styles.sectionTitle}>Art Styles</Text>
            <Text style={styles.sectionSubtitle}>
              Explore a few visual directions that shape the overall mood of the looks.
            </Text>

            <View style={[styles.artStylesGrid, isWide && styles.artStylesGridWide]}>
              {ART_STYLE_CARDS.map((card) => (
                <View key={card.title} style={styles.artStyleCard}>
                  <Image source={card.source} style={styles.artStyleImage} contentFit="cover" />
                  <LinearGradient
                    colors={["rgba(8,8,10,0.06)", "rgba(8,8,10,0.92)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={styles.artStyleOverlay}
                  >
                    <Text style={styles.artStyleTitle}>{card.title}</Text>
                    <Text style={styles.artStyleText}>{card.text}</Text>
                  </LinearGradient>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.legalFooter}>
            <Pressable onPress={() => router.push("/privacy")} style={({ pressed }) => [styles.footerLink, pressed && styles.footerLinkPressed]}>
              <Text style={styles.footerLinkText}>Privacy Policy</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/terms")} style={({ pressed }) => [styles.footerLink, pressed && styles.footerLinkPressed]}>
              <Text style={styles.footerLinkText}>Terms</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/contact")} style={({ pressed }) => [styles.footerLink, pressed && styles.footerLinkPressed]}>
              <Text style={styles.footerLinkText}>Contact</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/refund")} style={({ pressed }) => [styles.footerLink, pressed && styles.footerLinkPressed]}>
              <Text style={styles.footerLinkText}>Refunds</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Tag({ text }: { text: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{text}</Text>
    </View>
  );
}

function MiniCard({
  icon,
  title,
  text,
}: {
  icon: any;
  title: string;
  text: string;
}) {
  return (
    <View style={styles.miniCard}>
      <View style={styles.miniIconWrap}>
        <Ionicons name={icon} size={16} color="#F3D9B1" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.miniCardTitle}>{title}</Text>
        <Text style={styles.miniCardText}>{text}</Text>
      </View>
    </View>
  );
}

function GlowOrb({ style }: { style?: any }) {
  return <View style={[styles.orb, style]} />;
}

function FloatingWelcomeCard({
  source,
  label,
  style,
}: {
  source: number;
  label: string;
  style?: any;
}) {
  return (
    <View style={[styles.floatCard, style]}>
      <Image source={source} style={styles.floatCardImage} contentFit="cover" />
      <View style={styles.floatCardCaption}>
        <Text style={styles.floatCardCaptionText}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#0A0A0F",
  },
  safe: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 42,
  },
  scrollContentWide: {
    paddingHorizontal: 40,
    paddingTop: 24,
    paddingBottom: 54,
  },
  heroSection: {
    gap: 28,
  },
  heroSectionWide: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: Platform.OS === "web" ? 760 : undefined,
  },
  leftCol: {
    flex: 1,
    maxWidth: 720,
    zIndex: 2,
  },
  rightCol: {
    flex: 1,
    minHeight: 420,
    justifyContent: "center",
  },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 20,
  },
  badgeText: {
    color: "#F5E7D0",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  eyebrow: {
    color: "#B8A7C9",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2.2,
    marginBottom: 12,
  },
  title: {
    color: "#FAF7F2",
    fontSize: Platform.OS === "web" ? 64 : 42,
    lineHeight: Platform.OS === "web" ? 72 : 49,
    fontWeight: "700",
    letterSpacing: -1.8,
    marginBottom: 18,
    maxWidth: 760,
  },
  titleAccent: {
    color: "#E6C18F",
  },
  subtitle: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 17,
    lineHeight: 28,
    maxWidth: 640,
    marginBottom: 28,
  },
  ctaRow: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    alignItems: Platform.OS === "web" ? "center" : "stretch",
    gap: 14,
    marginBottom: 28,
  },
  primaryBtn: {
    borderRadius: 18,
    overflow: "hidden",
    alignSelf: "flex-start",
    shadowColor: "#F1D3A8",
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  primaryBtnGradient: {
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  primaryBtnText: {
    color: "#121212",
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryBtn: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignSelf: "flex-start",
  },
  secondaryBtnText: {
    color: "#F5F1EA",
    fontSize: 15,
    fontWeight: "600",
  },
  btnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginTop: 6,
  },
  statItem: {
    minWidth: 110,
    paddingRight: 10,
  },
  statValue: {
    color: "#F7E7CF",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 4,
  },
  statLabel: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 13,
  },
  visualWrap: {
    minHeight: 480,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    paddingVertical: 32,
  },
  orb: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(225, 187, 133, 0.14)",
  },
  orbOne: {
    top: 30,
    right: 60,
  },
  orbTwo: {
    bottom: 20,
    left: 20,
    backgroundColor: "rgba(169, 134, 214, 0.12)",
  },
  heroCard: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 30,
    padding: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    zIndex: 2,
  },
  cardOverline: {
    color: "#B8A7C9",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.8,
    marginBottom: 10,
  },
  heroCardTitle: {
    color: "#FCF8F1",
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "800",
    marginBottom: 18,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
  },
  tagText: {
    color: "#EEDFC8",
    fontSize: 12,
    fontWeight: "700",
  },
  previewPanel: {
    borderRadius: 22,
    backgroundColor: "rgba(8,8,12,0.34)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 16,
  },
  previewTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  previewLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    marginBottom: 6,
  },
  previewTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "700",
    maxWidth: 300,
  },
  previewIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(243,217,177,0.08)",
    borderWidth: 1,
    borderColor: "rgba(243,217,177,0.2)",
  },
  previewDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: 16,
  },
  miniCardsRow: {
    gap: 12,
  },
  floatCard: {
    position: "absolute",
    width: 164,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    shadowColor: "#000000",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    zIndex: 3,
  },
  floatCardOne: {
    top: 10,
    left: 8,
    transform: [{ rotate: "-10deg" }],
  },
  floatCardTwo: {
    top: -4,
    right: 12,
    width: 176,
    transform: [{ rotate: "9deg" }],
  },
  floatCardThree: {
    bottom: -4,
    right: 42,
    transform: [{ rotate: "-7deg" }],
  },
  floatCardImage: {
    width: "100%",
    aspectRatio: 1,
  },
  floatCardCaption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(12,12,15,0.92)",
  },
  floatCardCaptionText: {
    color: "#F3E6D0",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  miniCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    marginBottom: 10,
  },
  miniIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(243,217,177,0.08)",
  },
  miniCardTitle: {
    color: "#F7F3EE",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  miniCardText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
  },
  featuresSection: {
    marginTop: 36,
  },
  artStylesSection: {
    marginTop: 36,
  },
  sectionTitle: {
    color: "#FAF7F2",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
  },
  sectionSubtitle: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 18,
  },
  featuresGrid: {
    gap: 14,
  },
  featuresGridWide: {
    flexDirection: "row",
  },
  artStylesGrid: {
    gap: 14,
  },
  artStylesGridWide: {
    flexDirection: "row",
  },
  artStyleCard: {
    flex: 1,
    minHeight: 280,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  artStyleImage: {
    ...StyleSheet.absoluteFillObject,
  },
  artStyleOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 18,
    gap: 8,
  },
  artStyleTitle: {
    color: "#FAF7F2",
    fontSize: 20,
    fontWeight: "800",
  },
  artStyleText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 14,
    lineHeight: 22,
    maxWidth: 260,
  },
  featureCard: {
    flex: 1,
    borderRadius: 24,
    padding: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  featureIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(243,217,177,0.08)",
    marginBottom: 14,
  },
  featureTitle: {
    color: "#FAF7F2",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  featureText: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 14,
    lineHeight: 23,
  },
  legalFooter: {
    marginTop: 28,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  footerLink: {
    paddingVertical: 8,
  },
  footerLinkPressed: {
    opacity: 0.82,
  },
  footerLinkText: {
    color: "#D9C7A5",
    fontSize: 13,
    fontWeight: "600",
  },
});
