/**
 * The longest film Motify's AI makes for anyone, in seconds. A plan may set a
 * lower ceiling (the free plan's 10 seconds); none sets a higher one. A
 * request for more gets the strongest three-minute version instead, so the
 * composer warns before it is sent.
 *
 * Mirrors the backend's packages/ai/agent/film-length.ts, which enforces the
 * ceiling and reads the same lengths to time the run; change both together.
 */
export const MAX_FILM_SECONDS = 180;

const KHMER_DIGITS = "០១២៣៤៥៦៧៨៩";

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  ninety: 90,
  half: 0.5,
};

/** A number, in digits (Latin or Khmer, with a decimal point) or as an English word. */
const NUMBER = `(\\d+(?:[.,]\\d+)?|[${KHMER_DIGITS}]+(?:[.,][${KHMER_DIGITS}]+)?|${Object.keys(NUMBER_WORDS).join("|")})`;
// វិនាទី (second) ends in នាទី (minute), so seconds are tried first.
const UNIT =
  "(វិនាទី|នាទី|ម៉ោង|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h)";
const MENTION = new RegExp(
  `(?<![\\p{L}\\p{N}])${NUMBER}\\s*-?\\s*${UNIT}(?![\\p{L}])`,
  "giu",
);

/** Words that make a length the length of the video, when they sit right after it ("a 5-minute video", "4 mins long"). */
const AFTER =
  /^[\s-]*(?:of\s+)?(?:long|in length|video|film|clip|ad\b|advert|commercial|promo|reel|story|animation|explainer|tutorial|movie|វីដេអូ|ខ្លីប)/iu;
/** ...or right before it ("video of 5 minutes", "make it 4 minutes", "length: 3 min"). */
const BEFORE =
  /(?:video|film|clip|\bad|advert|commercial|promo|reel|animation|explainer|tutorial|movie|length|duration|runtime|make it|lasting|វីដេអូ|ខ្លីប|ប្រវែង|រយៈពេល)[^.!?\n]{0,24}$/iu;

/**
 * The film length a message asks for, in seconds, or undefined when it names
 * none. Only a length tied to the video counts: "a 5-minute video", "video of
 * 4 minutes", "វីដេអូ ៥ នាទី" - never "we deliver in 30 minutes". When it
 * names several, the longest is the film's: the others are its parts ("the
 * first 3 seconds"). "2 minutes 30 seconds" is read as one length.
 */
export function requestedFilmSeconds(message: string): number | undefined {
  const mentions = [...message.matchAll(MENTION)]
    .map((match) => ({
      start: match.index,
      end: match.index + match[0].length,
      seconds: toNumber(match[1] ?? "") * unitSeconds(match[2] ?? "s"),
    }))
    .filter(
      (mention) => Number.isFinite(mention.seconds) && mention.seconds > 0,
    );
  let longest: number | undefined;
  for (let index = 0; index < mentions.length; index += 1) {
    const mention = mentions[index];
    if (!mention) continue;
    let seconds = mention.seconds;
    let end = mention.end;
    // "2 minutes 30 seconds", "1 min and 20 sec": a smaller unit right after joins it.
    const next = mentions[index + 1];
    if (
      next &&
      next.seconds < seconds &&
      /^\s*(?:and|,)?\s*$/i.test(message.slice(end, next.start))
    ) {
      seconds += next.seconds;
      end = next.end;
      index += 1;
    }
    const tied =
      AFTER.test(message.slice(end, end + 24)) ||
      BEFORE.test(
        message.slice(Math.max(0, mention.start - 40), mention.start),
      );
    if (tied && (longest === undefined || seconds > longest)) longest = seconds;
  }
  return longest === undefined ? undefined : Math.round(longest * 10) / 10;
}

function toNumber(text: string): number {
  const word = NUMBER_WORDS[text.toLowerCase()];
  if (word !== undefined) return word;
  const latin = [...text]
    .map((char) => {
      const khmer = KHMER_DIGITS.indexOf(char);
      return khmer >= 0 ? String(khmer) : char;
    })
    .join("")
    .replace(",", ".");
  return Number(latin);
}

function unitSeconds(unit: string): number {
  const lower = unit.toLowerCase();
  if (lower === "វិនាទី" || lower.startsWith("s")) return 1;
  if (lower === "នាទី" || lower.startsWith("m")) return 60;
  return 3600;
}
