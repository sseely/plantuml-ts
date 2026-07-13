/**
 * Shared JSON-value helpers for the JSON builtin family
 * (`GetJsonKey`/`GetJsonType`/`JsonAdd`/`JsonKeyExists`/`JsonMerge`/
 * `JsonRemove`/`JsonSet`/`LoadJson`/`Str2Json`). Operates on plain JS
 * arrays/objects (`../expression/Token.js`'s `JsonValue`), per Batch 2a's
 * precedent of using native `JSON.parse`/plain values over porting
 * upstream's boxed `net.sourceforge.plantuml.json` AST
 * (`JsonValue`/`JsonObject`/`JsonArray`).
 *
 * Disclosed divergence from upstream's `JsonObject`: upstream's JSON object
 * is an ORDERED LIST of name/value pairs that permits duplicate names (its
 * `add` appends unconditionally; `get`/iteration return "the last one" on
 * duplicates). A plain JS object has Map-like unique-key semantics --
 * `JsonAdd`'s object branch (`json.asObject().add(name, value)`) therefore
 * cannot preserve a duplicate-key append the way upstream can; last-write-
 * wins here, matching this file's other JSON builtins' shared native-value
 * representation (Batch 2a already accepted this asymmetry for the
 * TIM JSON subsystem as a whole).
 */

import type { JsonValue } from '../expression/Token.js';

export type JsonObj = { [key: string]: JsonValue };

export function isJsonObject(v: JsonValue): v is JsonObj {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function isJsonArray(v: JsonValue): v is JsonValue[] {
  return Array.isArray(v);
}

/** `JsonValue#cloneMe()`: a full deep copy so mutation never aliases the source `TValue`. */
export function deepCloneJson(v: JsonValue): JsonValue {
  if (Array.isArray(v)) return v.map(deepCloneJson);
  if (isJsonObject(v)) {
    const result: JsonObj = {};
    for (const [k, val] of Object.entries(v)) result[k] = deepCloneJson(val);
    return result;
  }
  return v;
}

/**
 * `JsonObject#merge`: shallow `set(name, value)` of every member of `src`
 * into `dst`, overwriting on name collision.
 */
export function shallowMergeObjects(dst: JsonObj, src: Readonly<JsonObj>): JsonObj {
  for (const [k, v] of Object.entries(src)) dst[k] = v;
  return dst;
}

/**
 * `JsonObject#deepMerge`: like {@link shallowMergeObjects}, except when
 * both `dst[name]` and `src[name]` are themselves JSON objects, in which
 * case they are recursively deep-merged instead of `src`'s value replacing
 * `dst`'s outright.
 */
export function deepMergeObjects(dst: JsonObj, src: Readonly<JsonObj>): JsonObj {
  for (const [name, value] of Object.entries(src)) {
    const existing = dst[name];
    if (isJsonObject(value) && existing !== undefined && isJsonObject(existing)) {
      dst[name] = deepMergeObjects({ ...existing }, value);
    } else {
      dst[name] = value;
    }
  }
  return dst;
}
