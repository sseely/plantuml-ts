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
 * `InvokeProcedure`/`RetrieveProcedure` predate this batch (Batch 1/2a) and
 * deliberately do NOT implement `TFunction` the way the other 73 do -- see
 * their own file headers. They are re-exported here unmodified for barrel
 * completeness; Batch 4 (`TContext`/`FunctionsSet` wiring) resolves the
 * shape mismatch.
 */

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

// Pre-existing (Batch 1/2a) -- not TFunction-shaped, see file header.
export { INVOKE_PROCEDURE_NAME, resolveInvokeProcedureTarget, type InvokeProcedureTarget } from './InvokeProcedure.js';
export { RETRIEVE_PROCEDURE_NAME, resolveRetrieveProcedureTarget } from './RetrieveProcedure.js';

// Injected-seam type + default factory
export {
  createDefaultTimEnvironment,
  type TimEnvironment,
  type TimClock,
  type TimRandomSource,
  type StdlibFolderMetadata,
} from './TimEnvironment.js';
