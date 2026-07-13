/**
 * A disclosed subset of Java's `SimpleDateFormat` pattern language, used
 * only by `DateFunction` (`%date`). Full `SimpleDateFormat` is its own
 * substantial spec (quoted literals, `G`/`w`/`W`/`D`/`F`/`k`/`K`/`Z`/`X`
 * pattern letters, lenient parsing, ...); this ports the common subset
 * PlantUML fixtures actually exercise: `yyyy`/`yy`, `MMMM`/`MMM`/`MM`, `dd`,
 * `EEEE`/`EEE`, `HH`, `hh`, `mm`, `ss`, `SSS`, `a`. Unrecognized runs of
 * letters pass through unchanged rather than throwing, matching the spirit
 * (not the letter) of `SimpleDateFormat`'s lenient-pattern behavior.
 *
 * @see ~/git/plantuml/src/main/java/net/sourceforge/plantuml/tim/builtin/DateFunction.java
 */

interface DateParts {
  readonly year: number;
  readonly month: number; // 1-12
  readonly day: number;
  readonly hour: number; // 0-23
  readonly minute: number;
  readonly second: number;
  readonly millis: number;
  readonly weekday: number; // 0=Sunday
}

const MONTH_NAMES_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const MONTH_NAMES_SHORT = MONTH_NAMES_LONG.map((m) => m.slice(0, 3));
const WEEKDAY_NAMES_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_NAMES_SHORT = WEEKDAY_NAMES_LONG.map((d) => d.slice(0, 3));

/**
 * Resolve `epochMillis` to its field values in `timeZone` via
 * `Intl.DateTimeFormat`. Throws (propagating to the caller as a
 * `RangeError`) if `timeZone` is not a recognized IANA zone name.
 */
function resolveDateParts(epochMillis: number, timeZone: string): DateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  const parts = formatter.formatToParts(new Date(epochMillis));
  const get = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)?.value ?? '0';
  const weekdayShort = get('weekday');
  const weekday = WEEKDAY_NAMES_SHORT.findIndex((d) => d === weekdayShort);

  return {
    year: Number.parseInt(get('year'), 10),
    month: Number.parseInt(get('month'), 10),
    day: Number.parseInt(get('day'), 10),
    hour: Number.parseInt(get('hour') === '24' ? '0' : get('hour'), 10),
    minute: Number.parseInt(get('minute'), 10),
    second: Number.parseInt(get('second'), 10),
    millis: ((epochMillis % 1000) + 1000) % 1000,
    weekday: weekday < 0 ? 0 : weekday,
  };
}

const PAD2 = (n: number): string => String(n).padStart(2, '0');

/** Year/month/weekday tokens -- split out so `renderToken`'s switch stays small. */
function renderYearMonthWeekday(token: string, p: DateParts): string | undefined {
  switch (token) {
    case 'yyyy':
      return String(p.year).padStart(4, '0');
    case 'yy':
      return PAD2(p.year % 100);
    case 'MMMM':
      return MONTH_NAMES_LONG[p.month - 1] ?? '';
    case 'MMM':
      return MONTH_NAMES_SHORT[p.month - 1] ?? '';
    case 'MM':
      return PAD2(p.month);
    case 'EEEE':
      return WEEKDAY_NAMES_LONG[p.weekday] ?? '';
    case 'EEE':
      return WEEKDAY_NAMES_SHORT[p.weekday] ?? '';
    default:
      return undefined;
  }
}

/** Time-of-day tokens -- split out so `renderToken`'s switch stays small. */
function renderTimeOfDay(token: string, p: DateParts): string | undefined {
  switch (token) {
    case 'dd':
      return PAD2(p.day);
    case 'HH':
      return PAD2(p.hour);
    case 'hh':
      return PAD2(p.hour % 12 === 0 ? 12 : p.hour % 12);
    case 'mm':
      return PAD2(p.minute);
    case 'ss':
      return PAD2(p.second);
    case 'SSS':
      return String(p.millis).padStart(3, '0');
    case 'a':
      return p.hour < 12 ? 'AM' : 'PM';
    default:
      return undefined;
  }
}

function renderToken(token: string, parts: DateParts): string {
  return renderYearMonthWeekday(token, parts) ?? renderTimeOfDay(token, parts) ?? token;
}

/**
 * Format `epochMillis` (in `timeZone`) per `pattern`, a disclosed subset of
 * `SimpleDateFormat` syntax (see file header). Non-letter characters pass
 * through literally, matching `SimpleDateFormat`'s treatment of punctuation.
 * @throws RangeError if `timeZone` is unrecognized (from `Intl.DateTimeFormat`).
 */
export function formatDate(epochMillis: number, pattern: string, timeZone: string): string {
  const parts = resolveDateParts(epochMillis, timeZone);
  let result = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern.charAt(i);
    if (/[A-Za-z]/.test(ch)) {
      let j = i;
      while (j < pattern.length && pattern.charAt(j) === ch) j++;
      result += renderToken(pattern.slice(i, j), parts);
      i = j;
    } else {
      result += ch;
      i++;
    }
  }
  return result;
}
