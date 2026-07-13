/**
 * Barrel for every ported TIM builtin (`net.sourceforge.plantuml.tim.builtin`)
 * -- all 75 upstream classes (verified via `ls .../tim/builtin/*.java | wc -l`;
 * the mission brief's "76" is off by one against the actual upstream count).
 *
 * Most classes are constructed with no arguments. The following take an
 * injected {@link TimEnvironment} (clock / RNG / file-and-stdlib-and-theme
 * lookups -- see that file's header) because their upstream Java reaches
 * ambient global state this browser-safe port must not touch: `GetVersion`,
 * `Now`, `DateFunction`, `RandomFunction`, `Getenv`, `FileExists`,
 * `LoadJson`, `Dirpath`, `Filedate`, `Filename`, `FilenameNoExtension`,
 * `GetStdlib`, `GetAllStdlib`, `GetAllTheme`, `GetCurrentTheme`.
 *
 * `InvokeProcedure`/`RetrieveProcedure` were the two exceptions (resolver
 * functions written for the pre-TIM flat-loop expander rather than `TFunction`
 * implementations); batch SI5a-4 reconciled them onto the real model, so all
 * 75 are now uniform and {@link createStandardFunctions} registers every one.
 */

import { CallUserFunction } from './CallUserFunction.js';
import { StringFunction } from './StringFunction.js';
import { Dollar } from './Dollar.js';
import { Percent } from './Percent.js';
import { Lower } from './Lower.js';
import { Upper } from './Upper.js';
import { Backslash } from './Backslash.js';
import { LeftAlign } from './LeftAlign.js';
import { RightAlign } from './RightAlign.js';
import { Strlen } from './Strlen.js';
import { Tabulation } from './Tabulation.js';
import { Newline } from './Newline.js';
import { NewlineShort } from './NewlineShort.js';
import { Breakline } from './Breakline.js';
import { Chr } from './Chr.js';
import { Ord } from './Ord.js';
import { Substr } from './Substr.js';
import { SplitStr } from './SplitStr.js';
import { SplitStrRegex } from './SplitStrRegex.js';
import { Strpos } from './Strpos.js';
import { Dec2hex } from './Dec2hex.js';
import { Hex2dec } from './Hex2dec.js';
import { IntVal } from './IntVal.js';
import { BoolVal } from './BoolVal.js';
import { GetVersion } from './GetVersion.js';
import { Eval } from './Eval.js';
import { AlwaysFalse } from './AlwaysFalse.js';
import { AlwaysTrue } from './AlwaysTrue.js';
import { LogicalNot } from './LogicalNot.js';
import { LogicalAnd } from './LogicalAnd.js';
import { LogicalOr } from './LogicalOr.js';
import { LogicalXor } from './LogicalXor.js';
import { LogicalNand } from './LogicalNand.js';
import { LogicalNor } from './LogicalNor.js';
import { LogicalNxor } from './LogicalNxor.js';
import { Modulo } from './Modulo.js';
import { FunctionExists } from './FunctionExists.js';
import { VariableExists } from './VariableExists.js';
import { GetVariableValue } from './GetVariableValue.js';
import { SetVariableValue } from './SetVariableValue.js';
import { Feature } from './Feature.js';
import { Xargs } from './Xargs.js';
import { Size } from './Size.js';
import { Str2Json } from './Str2Json.js';
import { GetJsonType } from './GetJsonType.js';
import { GetJsonKey } from './GetJsonKey.js';
import { JsonKeyExists } from './JsonKeyExists.js';
import { JsonAdd } from './JsonAdd.js';
import { JsonRemove } from './JsonRemove.js';
import { JsonMerge } from './JsonMerge.js';
import { JsonSet } from './JsonSet.js';
import { LoadJson } from './LoadJson.js';
import { Darken } from './Darken.js';
import { Lighten } from './Lighten.js';
import { IsDark } from './IsDark.js';
import { IsLight } from './IsLight.js';
import { ReverseColor } from './ReverseColor.js';
import { ReverseHsluvColor } from './ReverseHsluvColor.js';
import { HslColor } from './HslColor.js';
import { Now } from './Now.js';
import { DateFunction } from './DateFunction.js';
import { Dirpath } from './Dirpath.js';
import { Filedate } from './Filedate.js';
import { Filename } from './Filename.js';
import { FilenameNoExtension } from './FilenameNoExtension.js';
import { FileExists } from './FileExists.js';
import { Getenv } from './Getenv.js';
import { RandomFunction } from './RandomFunction.js';
import { GetAllStdlib } from './GetAllStdlib.js';
import { GetAllTheme } from './GetAllTheme.js';
import { GetCurrentTheme } from './GetCurrentTheme.js';
import { GetStdlib } from './GetStdlib.js';
import { InvokeProcedure } from './InvokeProcedure.js';
import { RetrieveProcedure } from './RetrieveProcedure.js';
import type { TFunction } from '../TFunction.js';
import type { TimEnvironment } from './TimEnvironment.js';

export { SimpleReturnFunction } from './SimpleReturnFunction.js';
export { CallUserFunction } from './CallUserFunction.js';

// String / character
export { StringFunction } from './StringFunction.js';
export { Dollar } from './Dollar.js';
export { Percent } from './Percent.js';
export { Lower } from './Lower.js';
export { Upper } from './Upper.js';
export { Backslash } from './Backslash.js';
export { LeftAlign } from './LeftAlign.js';
export { RightAlign } from './RightAlign.js';
export { Strlen } from './Strlen.js';
export { Tabulation } from './Tabulation.js';
export { Newline } from './Newline.js';
export { NewlineShort } from './NewlineShort.js';
export { Breakline } from './Breakline.js';
export { Chr } from './Chr.js';
export { Ord } from './Ord.js';
export { Substr } from './Substr.js';
export { SplitStr } from './SplitStr.js';
export { SplitStrRegex } from './SplitStrRegex.js';
export { Strpos } from './Strpos.js';
export { Dec2hex } from './Dec2hex.js';
export { Hex2dec } from './Hex2dec.js';
export { IntVal } from './IntVal.js';
export { BoolVal } from './BoolVal.js';
export { GetVersion } from './GetVersion.js';
export { Eval } from './Eval.js';

// Logic / math
export { AlwaysFalse } from './AlwaysFalse.js';
export { AlwaysTrue } from './AlwaysTrue.js';
export { LogicalNot } from './LogicalNot.js';
export { LogicalAnd } from './LogicalAnd.js';
export { LogicalOr } from './LogicalOr.js';
export { LogicalXor } from './LogicalXor.js';
export { LogicalNand } from './LogicalNand.js';
export { LogicalNor } from './LogicalNor.js';
export { LogicalNxor } from './LogicalNxor.js';
export { Modulo } from './Modulo.js';

// Variable / function / meta
export { FunctionExists } from './FunctionExists.js';
export { VariableExists } from './VariableExists.js';
export { GetVariableValue } from './GetVariableValue.js';
export { SetVariableValue } from './SetVariableValue.js';
export { Feature } from './Feature.js';
export { Xargs } from './Xargs.js';
export { Size } from './Size.js';

// JSON family (TIM-json ledger entry -- zoriso-46, sidame)
export { Str2Json } from './Str2Json.js';
export { GetJsonType } from './GetJsonType.js';
export { GetJsonKey } from './GetJsonKey.js';
export { JsonKeyExists } from './JsonKeyExists.js';
export { JsonAdd } from './JsonAdd.js';
export { JsonRemove } from './JsonRemove.js';
export { JsonMerge } from './JsonMerge.js';
export { JsonSet } from './JsonSet.js';
export { LoadJson } from './LoadJson.js';

// Color
export { Darken } from './Darken.js';
export { Lighten } from './Lighten.js';
export { IsDark } from './IsDark.js';
export { IsLight } from './IsLight.js';
export { ReverseColor } from './ReverseColor.js';
export { ReverseHsluvColor } from './ReverseHsluvColor.js';
export { HslColor } from './HslColor.js';

// Environment / meta (seam-backed)
export { Now } from './Now.js';
export { DateFunction } from './DateFunction.js';
export { Dirpath } from './Dirpath.js';
export { Filedate } from './Filedate.js';
export { Filename } from './Filename.js';
export { FilenameNoExtension } from './FilenameNoExtension.js';
export { FileExists } from './FileExists.js';
export { Getenv } from './Getenv.js';
export { RandomFunction } from './RandomFunction.js';
export { GetAllStdlib } from './GetAllStdlib.js';
export { GetAllTheme } from './GetAllTheme.js';
export { GetCurrentTheme } from './GetCurrentTheme.js';
export { GetStdlib } from './GetStdlib.js';

export { InvokeProcedure } from './InvokeProcedure.js';
export { RetrieveProcedure } from './RetrieveProcedure.js';

// Injected-seam type + default factory
export {
  createDefaultTimEnvironment,
  type TimEnvironment,
  type TimClock,
  type TimRandomSource,
  type StdlibFolderMetadata,
} from './TimEnvironment.js';


/**
 * Every builtin, constructed in `TContext#addStandardFunctions`'s exact order.
 *
 * Upstream inlines 75 `functionsSet.addFunction(new X())` calls in `TContext`;
 * they live here so that `TContext.ts` stays under this repo's per-file size
 * gate and so the list sits next to the classes it names. Two upstream
 * registrations are guarded by `if (!TeaVM.isTeaVM())` (`GetAllStdlib`,
 * `GetStdlib`) -- i.e. skipped in the browser build. This port registers them
 * unconditionally: both resolve exclusively through the injected
 * {@link TimEnvironment} (whose default returns an empty stdlib), so they can
 * never touch a filesystem, and gating them out would make `%get_stdlib` an
 * unknown function rather than one that answers "nothing installed".
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/TContext.java#addStandardFunctions
 */
export function createStandardFunctions(env: TimEnvironment): readonly TFunction[] {
  return [
    new AlwaysFalse(),
    new AlwaysTrue(),
    new Backslash(),
    new BoolVal(),
    new Breakline(),
    new CallUserFunction(),
    new Chr(),
    new Darken(),
    new DateFunction(env),
    new Dec2hex(),
    new Dirpath(env),
    new Dollar(),
    new Eval(),
    new Feature(),
    new Filedate(env),
    new FileExists(env),
    new Filename(env),
    new FilenameNoExtension(env),
    new FunctionExists(),
    new GetAllStdlib(env),
    new GetAllTheme(env),
    new GetCurrentTheme(env),
    new GetJsonKey(),
    new GetJsonType(),
    new GetStdlib(env),
    new GetVariableValue(),
    new GetVersion(env),
    new Getenv(env),
    new Hex2dec(),
    new HslColor(),
    new IntVal(),
    new InvokeProcedure(),
    new IsDark(),
    new IsLight(),
    new JsonAdd(),
    new JsonKeyExists(),
    new JsonMerge(),
    new JsonRemove(),
    new JsonSet(),
    new LeftAlign(),
    new Lighten(),
    new LoadJson(env),
    new LogicalAnd(),
    new LogicalNand(),
    new LogicalNor(),
    new LogicalNot(),
    new LogicalNxor(),
    new LogicalOr(),
    new LogicalXor(),
    new Lower(),
    new Modulo(),
    new Newline(),
    new NewlineShort(),
    new Now(env),
    new Ord(),
    new Percent(),
    new RandomFunction(env),
    new RetrieveProcedure(),
    new ReverseColor(),
    new ReverseHsluvColor(),
    new RightAlign(),
    new SetVariableValue(),
    new Size(),
    new SplitStr(),
    new SplitStrRegex(),
    new Str2Json(),
    new StringFunction(),
    new Strlen(),
    new Strpos(),
    new Substr(),
    new Tabulation(),
    new Upper(),
    new VariableExists(),
    new Xargs(),
  ];
}
