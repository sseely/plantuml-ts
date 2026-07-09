import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.font.FontRenderContext;
import java.awt.font.LineMetrics;
import java.awt.image.BufferedImage;

/**
 * Prints, as JSON on stdout, per-glyph AWT advance widths plus ascent /
 * descent for the "SansSerif" logical font PlantUML uses by default for SVG
 * text (see net.sourceforge.plantuml.klimt.font.FontStack.SANS_SERIF and
 * FontParam.FAMILY in the upstream jar).
 *
 * <p>Reproduces the exact measurement path PlantUML's SVG string bounders
 * use: net.sourceforge.plantuml.FileFormat.getJavaDimension(UFont, String)
 * calls {@code FontMetrics.getStringBounds(text, gg)} against a Graphics2D
 * obtained from a dummy BufferedImage with TEXT_ANTIALIASING and
 * FRACTIONALMETRICS both switched ON (see FileFormat.java, StringBounderSvg
 * .java, StringBounderAwt.java). This intentionally does NOT use
 * {@code FontMetrics.charWidth(int)}, which returns rounded integers and is
 * NOT what the jar uses for text layout — see the "verification" section of
 * the emitted JSON, which shows charWidth()'s rounded value diverging from
 * the fractional value the jar actually places text with.
 *
 * <p>All codepoint advances are measured once at {@link #REFERENCE_SIZE} and
 * are per-point (divide by REFERENCE_SIZE) in the JSON output's
 * "advancesAtReference" map — see the "verification" section for evidence
 * that AWT's fractional-metrics advances scale exactly linearly with point
 * size, so a single per-point table reproduces every font size faithfully.
 */
public class ExtractJarFontMetrics {
  /** Basic Latin (32-126) + Latin-1 Supplement (128-255) + Latin Extended-A
   *  (256-591), covering the codepoint range description diagrams exercise. */
  static final int MIN_CODEPOINT = 32;
  static final int MAX_CODEPOINT = 591;

  /** Measured at a large size for precision, then divided down to a
   *  per-point value; see class javadoc + verification section for proof
   *  this reproduces any font size exactly (to double-precision epsilon). */
  static final double REFERENCE_SIZE = 100.0;

  public static void main(String[] args) {
    final Graphics2D gg = buildGraphics();
    final FontRenderContext frc = gg.getFontRenderContext();

    // FontStack.getFonts() resolves "SansSerif" via Font.decode(name) — the
    // same call PlantUML makes (see FontStack.java line ~79).
    final Font base = Font.decode("SansSerif");
    final Font refFont = base.deriveFont(Font.PLAIN, (float) REFERENCE_SIZE);
    final FontMetrics refFm = gg.getFontMetrics(refFont);

    final StringBuilder sb = new StringBuilder();
    sb.append("{\n");
    appendHeader(sb, refFont, refFm, frc);
    appendAdvances(sb, gg, refFm);
    appendVerification(sb, gg, base, refFm);
    sb.append("}\n");

    System.out.print(sb);
  }

  /** Mirrors net.sourceforge.plantuml.FileFormat.gg construction exactly: a
   *  dummy 100x100 BufferedImage with TEXT_ANTIALIASING + FRACTIONALMETRICS
   *  both ON. This is the Graphics2D every SVG string bounder measures
   *  against. */
  private static Graphics2D buildGraphics() {
    final BufferedImage imDummy = new BufferedImage(100, 100, BufferedImage.TYPE_INT_RGB);
    final Graphics2D gg = imDummy.createGraphics();
    gg.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
    gg.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS, RenderingHints.VALUE_FRACTIONALMETRICS_ON);
    return gg;
  }

  private static void appendHeader(StringBuilder sb, Font refFont, FontMetrics refFm, FontRenderContext frc) {
    // Ascent/descent via LineMetrics, matching StringBounderSvg.getDescent():
    // font.getUnderlayingFont(text).getLineMetrics(text, frc).getDescent().
    final LineMetrics refLm = refFont.getLineMetrics("Hg", frc);
    sb.append("  \"jvmVersion\": \"").append(esc(System.getProperty("java.version"))).append("\",\n");
    sb.append("  \"jvmVendor\": \"").append(esc(System.getProperty("java.vendor"))).append("\",\n");
    sb.append("  \"osName\": \"").append(esc(System.getProperty("os.name"))).append("\",\n");
    sb.append("  \"family\": \"SansSerif\",\n");
    sb.append("  \"resolvedFontName\": \"").append(esc(refFont.getFontName())).append("\",\n");
    sb.append("  \"referenceSize\": ").append((int) REFERENCE_SIZE).append(",\n");
    sb.append("  \"ascentAtReference\": ").append(refLm.getAscent()).append(",\n");
    sb.append("  \"descentAtReference\": ").append(refLm.getDescent()).append(",\n");
    sb.append("  \"heightAtReference\": ").append(refLm.getHeight()).append(",\n");
  }

  private static void appendAdvances(StringBuilder sb, Graphics2D gg, FontMetrics refFm) {
    sb.append("  \"advancesAtReference\": {\n");
    double sum = 0;
    int count = 0;
    for (int cp = MIN_CODEPOINT; cp <= MAX_CODEPOINT; cp++) {
      final String text = new String(Character.toChars(cp));
      final double advance = refFm.getStringBounds(text, gg).getWidth();
      sum += advance;
      count++;
      sb.append("    \"").append(cp).append("\": ").append(advance);
      if (cp != MAX_CODEPOINT) sb.append(",");
      sb.append("\n");
    }
    sb.append("  },\n");
    sb.append("  \"averageAdvanceAtReference\": ").append(sum / count).append(",\n");
  }

  /** Verification block, kept in the JSON output for spot-checking during
   *  regeneration: (a) direct measurement at 14pt/12pt against the
   *  reference-size measurement scaled by (size / REFERENCE_SIZE), and (b)
   *  whole-string vs. summed-per-glyph width, to confirm AWT applies no
   *  kerning for this font (so a per-glyph table is additive-safe). */
  private static void appendVerification(StringBuilder sb, Graphics2D gg, Font base, FontMetrics refFm) {
    sb.append("  \"verification\": {\n");
    appendPerCharVerification(sb, gg, base, refFm);
    appendStringVerification(sb, gg, base);
    sb.append("  }\n");
  }

  private static void appendPerCharVerification(StringBuilder sb, Graphics2D gg, Font base, FontMetrics refFm) {
    final int[] verifySizes = {14, 12};
    final String[] verifyChars = {"W", " ", "m", "i"};
    sb.append("    \"perChar\": [\n");
    boolean first = true;
    for (final int size : verifySizes) {
      final Font f = base.deriveFont(Font.PLAIN, (float) size);
      final FontMetrics fm = gg.getFontMetrics(f);
      for (final String ch : verifyChars) {
        if (!first) sb.append(",\n");
        first = false;
        sb.append(perCharEntry(gg, refFm, fm, ch, size));
      }
    }
    sb.append("\n    ],\n");
  }

  /** One {char, size} verification row: direct fractional measurement vs.
   *  the reference-size measurement scaled linearly, plus the rounded
   *  charWidth() int for contrast (see class javadoc). */
  private static String perCharEntry(Graphics2D gg, FontMetrics refFm, FontMetrics fm, String ch, int size) {
    final double direct = fm.getStringBounds(ch, gg).getWidth();
    final int cp = ch.codePointAt(0);
    final double refAdvance = refFm.getStringBounds(ch, gg).getWidth();
    final double scaled = refAdvance * (size / REFERENCE_SIZE);
    final int charWidthIntRounded = fm.charWidth(cp);
    return "      {\"char\": \"" + esc(ch) + "\", \"size\": " + size
        + ", \"directStringBounds\": " + direct
        + ", \"scaledFromReference\": " + scaled
        + ", \"delta\": " + (direct - scaled)
        + ", \"charWidthIntRounded\": " + charWidthIntRounded
        + "}";
  }

  private static void appendStringVerification(StringBuilder sb, Graphics2D gg, Font base) {
    final String[] testStrings = {"Hello World", "AVA", "Type"};
    sb.append("    \"strings\": [\n");
    final Font f14 = base.deriveFont(Font.PLAIN, 14f);
    final FontMetrics fm14 = gg.getFontMetrics(f14);
    for (int i = 0; i < testStrings.length; i++) {
      appendStringEntry(sb, gg, fm14, testStrings[i], i != testStrings.length - 1);
    }
    sb.append("    ]\n");
  }

  /** One test string's whole-string width vs. the sum of its per-glyph
   *  advances, to confirm AWT applies no kerning for this font/size. */
  private static void appendStringEntry(
      StringBuilder sb, Graphics2D gg, FontMetrics fm14, String s, boolean trailingComma) {
    final double whole = fm14.getStringBounds(s, gg).getWidth();
    double summed = 0;
    for (int j = 0; j < s.length(); j++) {
      summed += fm14.getStringBounds(String.valueOf(s.charAt(j)), gg).getWidth();
    }
    sb.append("      {\"text\": \"").append(esc(s)).append("\", \"wholeStringWidth\": ").append(whole)
        .append(", \"summedPerCharWidth\": ").append(summed)
        .append(", \"delta\": ").append(whole - summed).append("}");
    if (trailingComma) sb.append(",");
    sb.append("\n");
  }

  private static String esc(String s) {
    return s.replace("\\", "\\\\").replace("\"", "\\\"");
  }
}
