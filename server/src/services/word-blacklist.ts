const BLOCKED_WORDS = [
  'fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'shitty', 'bullshit', 'shithead', 'dipshit', 'bitch', 'bastard',
  'asshole', 'assholes', 'dumbass', 'jackass', 'dickhead', 'dickheads', 'dick', 'cock', 'pussy', 'cunt',
  'whore', 'slut', 'nigger', 'nigga', 'faggot', 'fag', 'retard', 'retarded',
  'rape', 'rapist', 'nazi', 'hitler', 'porn', 'dildo', 'douchebag', 'douche',
];

const WORD_PATTERN = new RegExp(`\\b(?:${BLOCKED_WORDS.join('|')})\\b`, 'i');

const LEET_MAP: Readonly<Record<string, string>> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '8': 'b',
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[0134578@$]/g, char => LEET_MAP[char] ?? char);
}

export function containsBlockedWord(text: string): boolean {
  return WORD_PATTERN.test(normalize(text));
}
