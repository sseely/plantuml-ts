# Batch 2 — sprite + png + creole (parallel, needs batch 1)

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T4 | Sprite subsystem + shared definition matcher + registry | typescript-pro | src/core/klimt/sprite/{SpriteGrayLevel,SpriteMonochrome,Sprite}.ts, src/core/sprite-commands.ts (shared matcher), per-parser wiring (same dispatch positions as the G0b annotation matcher — see plans/g0b-annotations/batch-2/T5/T6 for per-engine positions), registry on the skinparam/theme context, tests/unit/sprite-*.test.ts | T2 | [x] |
| T5 | Deterministic stored-block PNG encoder + monochrome tint | typescript-pro | src/core/klimt/sprite/png-encoder.ts (or upstream-adjacent name — check PixelImage/SImageIO naming and mirror), tint port of SpriteMonochrome.toUImage (java :180-208), tests/unit/png-encoder.test.ts | T2 | [x] |
| T6 | Creole `<img>`/`<$sprite>` atoms + IHDR dims + measurement | typescript-pro | src/core/creole.ts (+ split module if 500-line cap — check current size), src/core/klimt/sprite/png-ihdr.ts, measurement integration in the description label path (link-edge-attrs.ts / measure seams — READ how I5 (plans/description-dot-100) wired resolveInlineLinks; same site), tests/unit/creole-img.test.ts | T2 | [x] |

T4/T6 both touch creole-adjacent code — write-sets are disjoint (T4 owns
sprite definition PARSING + registry; T6 owns the inline ATOM parsing +
measurement) but coordinate via the interface below. If a real file
collision emerges, T6 yields the file and reports.

Upstream refs (from mission research; quote-level details in the research
report embedded here):
- Grammar: CommandFactorySprite.java:60-77 (`sprite $name [WxH/Nz|color] {`,
  end `^end[%s]?sprite|\}$`); dispatch :183-210 (no-DIM → GRAY_16 hex; /Nz →
  buildSpriteZ over concatenated trimmed lines).
- Decode: SpriteGrayLevel.buildSpriteZ (java :292-307) = AsciiEncoder.decode
  → raw-inflate → row-major gray bytes into SpriteMonochrome(w,h,nbColor).
  Hex path buildSprite16 :189-206; 8/4-level use decode6bit packing
  :208-245.
- Registry: WithSprite.addSprite → SkinParam.sprites map (java :784-797).
- Atoms: CommandCreoleImg (Splitter.imgPatternNoSrcColon =
  `\<img[\s:]+([^>{}]+)({scale=[0-9.]+})?\>`, Splitter.java:58; strip
  leading `src=`/quotes); CommandCreoleSprite (starters `<#`,`<$`;
  `<#COLOR$name>` forced color; `{scale=N}`); StripeSimple.addSprite
  :228-236 (unknown sprite name → atom NOT added — silently nothing);
  AtomImg.create :105-200 (`data:image/png;base64,` branch only; http/svg
  out of scope).
- Tint: SpriteMonochrome.toUImage :180-208 — gradient(backcolor,
  fontColor-or-forced), coefficient = gray/(grayLevel-1), alpha from
  coefficient (transparent at gray 0).
- Measurement (D9): atom dims = scaled pixel dims; sprites 64x64 etc.;
  img dims from IHDR (bytes 16-23 big-endian after the 8-byte signature).

Interface contract (T4→T6/T7): `Sprite { width, height, asPng(fontColor,
backColor, scale): { dataUri, w, h } }` + `SpriteRegistry.get(name)`.
(T5 provides asPng's encoder.)

Gates after batch: full gates + DOT FROZEN exact — atoms parse/measure in
unit tests only; no fixture carries sprites into the gated corpus until T9
supplies the store (the 6 fixtures still error at include).
