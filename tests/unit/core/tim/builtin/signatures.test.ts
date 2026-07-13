/**
 * Table-driven coverage of every builtin's `getSignature()` (name + declared
 * arity) and `canCover()` boundary behavior -- the shape every builtin
 * shares, exercised once here rather than repeated per-builtin in the
 * behavior-focused suites (`string-functions.test.ts` etc).
 *
 * A few `validArgCounts`/`nbArg` pairs intentionally diverge (documented
 * inline) -- faithfully-ported upstream quirks where the declared
 * `TFunctionSignature` arity and the actual `canCover` acceptance differ
 * (e.g. `%splitstr`'s signature says 3 but `canCover` only accepts 2).
 */
import { describe, expect, it } from 'vitest';
import type { TFunction } from '../../../../../src/core/tim/TFunction.js';
import {
  createDefaultTimEnvironment,
  type TimEnvironment,
} from '../../../../../src/core/tim/builtin/TimEnvironment.js';
import { NO_MEMORY } from '../../../../helpers/tim-builtin.js';

import { StringFunction } from '../../../../../src/core/tim/builtin/StringFunction.js';
import { Dollar } from '../../../../../src/core/tim/builtin/Dollar.js';
import { Percent } from '../../../../../src/core/tim/builtin/Percent.js';
import { Lower } from '../../../../../src/core/tim/builtin/Lower.js';
import { Upper } from '../../../../../src/core/tim/builtin/Upper.js';
import { Backslash } from '../../../../../src/core/tim/builtin/Backslash.js';
import { LeftAlign } from '../../../../../src/core/tim/builtin/LeftAlign.js';
import { RightAlign } from '../../../../../src/core/tim/builtin/RightAlign.js';
import { Strlen } from '../../../../../src/core/tim/builtin/Strlen.js';
import { Tabulation } from '../../../../../src/core/tim/builtin/Tabulation.js';
import { Newline } from '../../../../../src/core/tim/builtin/Newline.js';
import { NewlineShort } from '../../../../../src/core/tim/builtin/NewlineShort.js';
import { Breakline } from '../../../../../src/core/tim/builtin/Breakline.js';
import { Chr } from '../../../../../src/core/tim/builtin/Chr.js';
import { Ord } from '../../../../../src/core/tim/builtin/Ord.js';
import { Substr } from '../../../../../src/core/tim/builtin/Substr.js';
import { SplitStr } from '../../../../../src/core/tim/builtin/SplitStr.js';
import { SplitStrRegex } from '../../../../../src/core/tim/builtin/SplitStrRegex.js';
import { Strpos } from '../../../../../src/core/tim/builtin/Strpos.js';
import { Dec2hex } from '../../../../../src/core/tim/builtin/Dec2hex.js';
import { Hex2dec } from '../../../../../src/core/tim/builtin/Hex2dec.js';
import { IntVal } from '../../../../../src/core/tim/builtin/IntVal.js';
import { BoolVal } from '../../../../../src/core/tim/builtin/BoolVal.js';
import { GetVersion } from '../../../../../src/core/tim/builtin/GetVersion.js';
import { Eval } from '../../../../../src/core/tim/builtin/Eval.js';
import { AlwaysFalse } from '../../../../../src/core/tim/builtin/AlwaysFalse.js';
import { AlwaysTrue } from '../../../../../src/core/tim/builtin/AlwaysTrue.js';
import { LogicalNot } from '../../../../../src/core/tim/builtin/LogicalNot.js';
import { LogicalAnd } from '../../../../../src/core/tim/builtin/LogicalAnd.js';
import { LogicalOr } from '../../../../../src/core/tim/builtin/LogicalOr.js';
import { LogicalXor } from '../../../../../src/core/tim/builtin/LogicalXor.js';
import { LogicalNand } from '../../../../../src/core/tim/builtin/LogicalNand.js';
import { LogicalNor } from '../../../../../src/core/tim/builtin/LogicalNor.js';
import { LogicalNxor } from '../../../../../src/core/tim/builtin/LogicalNxor.js';
import { Modulo } from '../../../../../src/core/tim/builtin/Modulo.js';
import { FunctionExists } from '../../../../../src/core/tim/builtin/FunctionExists.js';
import { VariableExists } from '../../../../../src/core/tim/builtin/VariableExists.js';
import { GetVariableValue } from '../../../../../src/core/tim/builtin/GetVariableValue.js';
import { SetVariableValue } from '../../../../../src/core/tim/builtin/SetVariableValue.js';
import { Feature } from '../../../../../src/core/tim/builtin/Feature.js';
import { Xargs } from '../../../../../src/core/tim/builtin/Xargs.js';
import { Size } from '../../../../../src/core/tim/builtin/Size.js';
import { Str2Json } from '../../../../../src/core/tim/builtin/Str2Json.js';
import { GetJsonType } from '../../../../../src/core/tim/builtin/GetJsonType.js';
import { GetJsonKey } from '../../../../../src/core/tim/builtin/GetJsonKey.js';
import { JsonKeyExists } from '../../../../../src/core/tim/builtin/JsonKeyExists.js';
import { JsonAdd } from '../../../../../src/core/tim/builtin/JsonAdd.js';
import { JsonRemove } from '../../../../../src/core/tim/builtin/JsonRemove.js';
import { JsonMerge } from '../../../../../src/core/tim/builtin/JsonMerge.js';
import { JsonSet } from '../../../../../src/core/tim/builtin/JsonSet.js';
import { LoadJson } from '../../../../../src/core/tim/builtin/LoadJson.js';
import { Darken } from '../../../../../src/core/tim/builtin/Darken.js';
import { Lighten } from '../../../../../src/core/tim/builtin/Lighten.js';
import { IsDark } from '../../../../../src/core/tim/builtin/IsDark.js';
import { IsLight } from '../../../../../src/core/tim/builtin/IsLight.js';
import { ReverseColor } from '../../../../../src/core/tim/builtin/ReverseColor.js';
import { ReverseHsluvColor } from '../../../../../src/core/tim/builtin/ReverseHsluvColor.js';
import { HslColor } from '../../../../../src/core/tim/builtin/HslColor.js';
import { Now } from '../../../../../src/core/tim/builtin/Now.js';
import { DateFunction } from '../../../../../src/core/tim/builtin/DateFunction.js';
import { Dirpath } from '../../../../../src/core/tim/builtin/Dirpath.js';
import { Filedate } from '../../../../../src/core/tim/builtin/Filedate.js';
import { Filename } from '../../../../../src/core/tim/builtin/Filename.js';
import { FilenameNoExtension } from '../../../../../src/core/tim/builtin/FilenameNoExtension.js';
import { FileExists } from '../../../../../src/core/tim/builtin/FileExists.js';
import { Getenv } from '../../../../../src/core/tim/builtin/Getenv.js';
import { RandomFunction } from '../../../../../src/core/tim/builtin/RandomFunction.js';
import { GetAllStdlib } from '../../../../../src/core/tim/builtin/GetAllStdlib.js';
import { GetAllTheme } from '../../../../../src/core/tim/builtin/GetAllTheme.js';
import { GetCurrentTheme } from '../../../../../src/core/tim/builtin/GetCurrentTheme.js';
import { GetStdlib } from '../../../../../src/core/tim/builtin/GetStdlib.js';
import { CallUserFunction } from '../../../../../src/core/tim/builtin/CallUserFunction.js';

const env: TimEnvironment = createDefaultTimEnvironment();

interface Case {
  readonly label: string;
  readonly fn: TFunction;
  readonly name: string;
  readonly nbArg: number;
  readonly valid: readonly number[];
  readonly invalid: readonly number[];
}

const cases: readonly Case[] = [
  { label: 'StringFunction', fn: new StringFunction(), name: '%string', nbArg: 1, valid: [1], invalid: [0, 2] },
  { label: 'Dollar', fn: new Dollar(), name: '%dollar', nbArg: 0, valid: [0], invalid: [1] },
  { label: 'Percent', fn: new Percent(), name: '%percent', nbArg: 0, valid: [0], invalid: [1] },
  { label: 'Lower', fn: new Lower(), name: '%lower', nbArg: 1, valid: [1], invalid: [0, 2] },
  { label: 'Upper', fn: new Upper(), name: '%upper', nbArg: 1, valid: [1], invalid: [0, 2] },
  { label: 'Backslash', fn: new Backslash(), name: '%backslash', nbArg: 0, valid: [0], invalid: [1] },
  { label: 'LeftAlign', fn: new LeftAlign(), name: '%left_align', nbArg: 0, valid: [0], invalid: [1] },
  { label: 'RightAlign', fn: new RightAlign(), name: '%right_align', nbArg: 0, valid: [0], invalid: [1] },
  { label: 'Strlen', fn: new Strlen(), name: '%strlen', nbArg: 1, valid: [1], invalid: [0, 2] },
  { label: 'Tabulation', fn: new Tabulation(), name: '%tab', nbArg: 0, valid: [0], invalid: [1] },
  { label: 'Newline', fn: new Newline(), name: '%newline', nbArg: 0, valid: [0], invalid: [1] },
  { label: 'NewlineShort', fn: new NewlineShort(), name: '%n', nbArg: 0, valid: [0], invalid: [1] },
  { label: 'Breakline', fn: new Breakline(), name: '%breakline', nbArg: 0, valid: [0], invalid: [1] },
  { label: 'Chr', fn: new Chr(), name: '%chr', nbArg: 1, valid: [1], invalid: [0, 2] },
  { label: 'Ord', fn: new Ord(), name: '%ord', nbArg: 1, valid: [1], invalid: [0, 2] },
  { label: 'Substr', fn: new Substr(), name: '%substr', nbArg: 3, valid: [2, 3], invalid: [1, 4] },
  // Upstream quirk: TFunctionSignature declares nbArg 3, but canCover only accepts 2.
  { label: 'SplitStr', fn: new SplitStr(), name: '%splitstr', nbArg: 3, valid: [2], invalid: [1, 3] },
  { label: 'SplitStrRegex', fn: new SplitStrRegex(), name: '%splitstr_regex', nbArg: 2, valid: [2], invalid: [1, 3] },
  { label: 'Strpos', fn: new Strpos(), name: '%strpos', nbArg: 2, valid: [2], invalid: [1, 3] },
  { label: 'Dec2hex', fn: new Dec2hex(), name: '%dec2hex', nbArg: 1, valid: [1], invalid: [0, 2] },
  { label: 'Hex2dec', fn: new Hex2dec(), name: '%hex2dec', nbArg: 1, valid: [1], invalid: [0, 2] },
  { label: 'IntVal', fn: new IntVal(), name: '%intval', nbArg: 1, valid: [1], invalid: [0, 2] },
  { label: 'BoolVal', fn: new BoolVal(), name: '%boolval', nbArg: 1, valid: [1], invalid: [0, 2] },
  { label: 'GetVersion', fn: new GetVersion(env), name: '%version', nbArg: 0, valid: [0], invalid: [1] },
  { label: 'Eval', fn: new Eval(), name: '%eval', nbArg: 1, valid: [1], invalid: [0, 2] },
  { label: 'AlwaysFalse', fn: new AlwaysFalse(), name: '%false', nbArg: 0, valid: [0], invalid: [1] },
  { label: 'AlwaysTrue', fn: new AlwaysTrue(), name: '%true', nbArg: 0, valid: [0], invalid: [1] },
  { label: 'LogicalNot', fn: new LogicalNot(), name: '%not', nbArg: 1, valid: [1], invalid: [0, 2] },
  { label: 'LogicalAnd', fn: new LogicalAnd(), name: '%and', nbArg: 2, valid: [2, 3], invalid: [0, 1] },
  { label: 'LogicalOr', fn: new LogicalOr(), name: '%or', nbArg: 2, valid: [2, 3], invalid: [0, 1] },
  { label: 'LogicalXor', fn: new LogicalXor(), name: '%xor', nbArg: 2, valid: [2, 3], invalid: [0, 1] },
  { label: 'LogicalNand', fn: new LogicalNand(), name: '%nand', nbArg: 2, valid: [2, 3], invalid: [0, 1] },
  { label: 'LogicalNor', fn: new LogicalNor(), name: '%nor', nbArg: 2, valid: [2, 3], invalid: [0, 1] },
  { label: 'LogicalNxor', fn: new LogicalNxor(), name: '%nxor', nbArg: 2, valid: [2, 3], invalid: [0, 1] },
  { label: 'Modulo', fn: new Modulo(), name: '%mod', nbArg: 2, valid: [2], invalid: [1, 3] },
  {
    label: 'FunctionExists',
    fn: new FunctionExists(),
    name: '%function_exists',
    nbArg: 1,
    valid: [1],
    invalid: [0, 2],
  },
  {
    label: 'VariableExists',
    fn: new VariableExists(),
    name: '%variable_exists',
    nbArg: 1,
    valid: [1],
    invalid: [0, 2],
  },
  {
    label: 'GetVariableValue',
    fn: new GetVariableValue(),
    name: '%get_variable_value',
    nbArg: 1,
    valid: [1],
    invalid: [0, 2],
  },
  {
    label: 'SetVariableValue',
    fn: new SetVariableValue(),
    name: '%set_variable_value',
    nbArg: 2,
    valid: [2],
    invalid: [1, 3],
  },
  { label: 'Feature', fn: new Feature(), name: '%feature', nbArg: 1, valid: [1], invalid: [0, 2] },
  // Upstream quirk: TFunctionSignature declares nbArg 0, but canCover requires exactly 1.
  { label: 'Xargs', fn: new Xargs(), name: '%xargs', nbArg: 0, valid: [1], invalid: [0, 2] },
  { label: 'Size', fn: new Size(), name: '%size', nbArg: 1, valid: [1], invalid: [0, 2] },
  { label: 'Str2Json', fn: new Str2Json(), name: '%str2json', nbArg: 1, valid: [1], invalid: [0, 2] },
  { label: 'GetJsonType', fn: new GetJsonType(), name: '%get_json_type', nbArg: 1, valid: [1], invalid: [0, 2] },
  { label: 'GetJsonKey', fn: new GetJsonKey(), name: '%get_json_keys', nbArg: 1, valid: [1], invalid: [0, 2] },
  // Upstream quirk: TFunctionSignature declares nbArg 1, but canCover requires exactly 2.
  { label: 'JsonKeyExists', fn: new JsonKeyExists(), name: '%json_key_exists', nbArg: 1, valid: [2], invalid: [0, 1] },
  { label: 'JsonAdd', fn: new JsonAdd(), name: '%json_add', nbArg: 3, valid: [2, 3], invalid: [1, 4] },
  { label: 'JsonRemove', fn: new JsonRemove(), name: '%json_remove', nbArg: 2, valid: [2], invalid: [1, 3] },
  { label: 'JsonMerge', fn: new JsonMerge(), name: '%json_merge', nbArg: 2, valid: [2], invalid: [1, 3] },
  { label: 'JsonSet', fn: new JsonSet(), name: '%json_set', nbArg: 3, valid: [2, 3], invalid: [1, 4] },
  { label: 'LoadJson', fn: new LoadJson(env), name: '%load_json', nbArg: 3, valid: [1, 2, 3], invalid: [0, 4] },
  { label: 'Darken', fn: new Darken(), name: '%darken', nbArg: 2, valid: [2], invalid: [1, 3] },
  { label: 'Lighten', fn: new Lighten(), name: '%lighten', nbArg: 2, valid: [2], invalid: [1, 3] },
  { label: 'IsDark', fn: new IsDark(), name: '%is_dark', nbArg: 1, valid: [1], invalid: [0, 2] },
  { label: 'IsLight', fn: new IsLight(), name: '%is_light', nbArg: 1, valid: [1], invalid: [0, 2] },
  { label: 'ReverseColor', fn: new ReverseColor(), name: '%reverse_color', nbArg: 1, valid: [1], invalid: [0, 2] },
  {
    label: 'ReverseHsluvColor',
    fn: new ReverseHsluvColor(),
    name: '%reverse_hsluv_color',
    nbArg: 1,
    valid: [1],
    invalid: [0, 2],
  },
  { label: 'HslColor', fn: new HslColor(), name: '%hsl_color', nbArg: 3, valid: [3, 4], invalid: [2, 5] },
  { label: 'Now', fn: new Now(env), name: '%now', nbArg: 0, valid: [0], invalid: [1] },
  { label: 'DateFunction', fn: new DateFunction(env), name: '%date', nbArg: 3, valid: [0, 1, 2, 3], invalid: [4] },
  { label: 'Dirpath', fn: new Dirpath(env), name: '%dirpath', nbArg: 0, valid: [0], invalid: [1] },
  { label: 'Filedate', fn: new Filedate(env), name: '%filedate', nbArg: 0, valid: [0], invalid: [1] },
  { label: 'Filename', fn: new Filename(env), name: '%filename', nbArg: 0, valid: [0], invalid: [1] },
  {
    label: 'FilenameNoExtension',
    fn: new FilenameNoExtension(env),
    name: '%filename_no_extension',
    nbArg: 0,
    valid: [0],
    invalid: [1],
  },
  { label: 'FileExists', fn: new FileExists(env), name: '%file_exists', nbArg: 1, valid: [1], invalid: [0, 2] },
  { label: 'Getenv', fn: new Getenv(env), name: '%getenv', nbArg: 1, valid: [1], invalid: [0, 2] },
  { label: 'RandomFunction', fn: new RandomFunction(env), name: '%random', nbArg: 2, valid: [0, 1, 2], invalid: [3] },
  { label: 'GetAllStdlib', fn: new GetAllStdlib(env), name: '%get_all_stdlib', nbArg: 1, valid: [0, 1], invalid: [2] },
  { label: 'GetAllTheme', fn: new GetAllTheme(env), name: '%get_all_theme', nbArg: 0, valid: [0], invalid: [1] },
  {
    label: 'GetCurrentTheme',
    fn: new GetCurrentTheme(env),
    name: '%get_current_theme',
    nbArg: 0,
    valid: [0],
    invalid: [1],
  },
  { label: 'GetStdlib', fn: new GetStdlib(env), name: '%get_stdlib', nbArg: 1, valid: [0, 1, 2], invalid: [3] },
  {
    label: 'CallUserFunction',
    fn: new CallUserFunction(),
    name: '%call_user_func',
    nbArg: 1,
    valid: [1, 2],
    invalid: [0],
  },
];

describe.each(cases)('$label', ({ fn, name, nbArg, valid, invalid }) => {
  it('declares its upstream signature name and arity', () => {
    expect(fn.getSignature().getFunctionName()).toBe(name);
    expect(fn.getSignature().getNbArg()).toBe(nbArg);
  });

  it('canCover accepts its documented valid arities', () => {
    for (const n of valid) expect(fn.canCover(n, new Set())).toBe(true);
  });

  it('canCover rejects its documented invalid arities', () => {
    for (const n of invalid) expect(fn.canCover(n, new Set())).toBe(false);
  });

  it('is a RETURN function that is never unquoted, per SimpleReturnFunction', () => {
    expect(fn.getFunctionType()).toBe('RETURN_FUNCTION');
    expect(fn.isUnquoted()).toBe(false);
  });

  it('executeProcedureInternal always throws (RETURN functions are never procedures)', () => {
    expect(() =>
      fn.executeProcedureInternal(undefined as never, NO_MEMORY, undefined as never, [], new Map()),
    ).toThrow();
  });
});
