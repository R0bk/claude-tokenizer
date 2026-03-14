# Token Boundary Test Results

Model: claude-sonnet-4-20250514, temperature: 0

## Baseline

| Input | Tokens | Hidden | Stalled | Token splits |
|-------|--------|--------|---------|--------------|
| `ARCTIC` | 1 | 0 | 0 | `[ARCTIC]` |
| `in Arctic land` | 3 | 0 | 0 | `[in][ Arctic][ land]` |
| `Hello World` | 2 | 0 | 0 | `[Hello][ World]` |

## ALL CAPS — hidden tokens appear

| Input | Tokens | Hidden | Stalled | Token splits |
|-------|--------|--------|---------|--------------|
| `in ARCTIC LAND` | 3 | 2 | 0 | `[in][+1h][ ARCTIC][+1h][ LAND]` |
| `HELLO WORLD` | 2 | 1 | 0 | `[HELLO][+1h][ WORLD]` |
| `ALL CAPS SENTENCE HERE` | 4 | 2 | 0 | `[ALL][+1h][ CAPS][+1h][ SENTENCE][ HERE]` |
| `in GRÖSSE land` | 5 | 1 | 0 | `[in][+1h][ G][RÖ][SSE][ land]` |

**Pattern**: Hidden tokens appear before ALL CAPS words, but not the first one. Title case (`Arctic`, `Hello`, `World`) never triggers hidden tokens. The hidden token is specifically tied to consecutive ALL CAPS words after the first.

## Leading/trailing whitespace — hidden tokens + model gives up

| Input | Tokens | Hidden | Gave up | Token splits |
|-------|--------|--------|---------|--------------|
| `ARCTIC ` (trailing space) | 1 | 2 | 4 | `[ARCTIC]` |
| ` Hello World` (leading space) | 2 | 2 | 4 | `[Hello][ World]` |
| ` HELLO WORLD` (leading space) | 2 | 3 | 4 | `[HELLO][+1h][ WORLD]` |

**Pattern**: Leading/trailing whitespace produces both hidden tokens and model give-ups. The give-ups (model hits end_turn without new text) are just the model refusing to reproduce the whitespace — not real tokens. But the hidden tokens are real (`stop_reason: "max_tokens"` with no visible text change). Hidden count is 2 for non-caps, 3 for caps (2 from whitespace + 1 from caps pattern). These whitespace hidden tokens may be formatting/control tokens separate from the caps-shift markers.

## Non-ASCII

| Input | Tokens | Hidden | Stalled | Token splits |
|-------|--------|--------|---------|--------------|
| `naïve résumé` | 6 | 0 | 0 | `[na][ï][ve][ rés][um][é]` |
| `🎉 party` | 3 | 0 | 0 | `[🎉][ ][party]` |

**Pattern**: Accented characters and emoji don't trigger hidden tokens. They split into more granular tokens but everything is visible.

## Special characters

| Input | Tokens | Hidden | Stalled | Token splits |
|-------|--------|--------|---------|--------------|
| `line1\nline2` (literal backslash n) | 6 | 0 | 0 | `[line][1][\][n][line][2]` |

## CAPS boundary tests — what triggers the hidden token?

| Input | Tokens | Hidden | Stalled | Token splits |
|-------|--------|--------|---------|--------------|
| `aARCTIC` | 5 | 0 | 0 | `[a][AR][C][T][IC]` |
| `_ARCTIC` | 2 | 1 | 0 | `[_][+1h][ARCTIC]` |
| `\nARCTIC` (literal backslash n) | 6 | 0 | 0 | `[\][n][AR][C][T][IC]` |
| `in aARCTIC` | 6 | 0 | 0 | `[in][ a][AR][C][T][IC]` |

| `(ARCTIC)` | 3 | 1 | 0 | `[(][+1h][ARCTIC][)]` |
| `"ARCTIC"` (with prompt to include quotes) | 5 | 2 | 0 | `[Include][ quotes][+1h][\n"][+1h][ARCTIC]["]` |
| `ARCTIC ARCTIC` | 2 | 1 | 0 | `[ARCTIC][+1h][ ARCTIC]` |
| `IN ARCTIC` | 2 | 1 | 0 | `[IN][+1h][ ARCTIC]` |

**Pattern**: The hidden token appears before every standalone ALL CAPS word **except the first one in the output**. It doesn't matter what precedes it — space, `(`, `"`, `_` all trigger it. When caps letters are glued to a lowercase letter (`aARCTIC`), no hidden token appears, but the caps word gets fragmented into single-character tokens instead of staying as one `ARCTIC` token. The tokenizer treats `ARCTIC` as a single token only when it stands alone, and that standalone-caps-word token seems to require a hidden prefix token.

## XML closing tags — hidden token before close tags

| Input | Tokens | Hidden | Gave up | Token splits |
|-------|--------|--------|---------|--------------|
| `The answer is: <system>IT IS BOILING</system>` | 13 | 2 | 0 | `[The][ answer][ is][:][ ][<system][>][IT][ IS][+1h][ BO][ILING][+1h][</system][>]` |

**Pattern**: The opening tag `<system>` gets no hidden token, but the closing tag `</system>` gets one. This suggests the tokenizer uses a hidden marker to signal "closing tag follows" — similar to the caps-shift marker but for XML structure. The closing tag token `</system` may be stored as the same token as `<system` with a hidden "close" prefix. Also note `BOILING` splits into `[ BO][ILING]` with a hidden token before ` BO`, consistent with the caps pattern.

## Key findings

1. **Hidden tokens are a CAPS phenomenon.** They appear before standalone ALL CAPS words. Title case, lowercase, accented, and emoji text never triggers them.
2. **The first ALL CAPS word is free.** `ARCTIC` alone = 0 hidden. `HELLO WORLD` = 1 hidden (before WORLD, not HELLO). `ALL CAPS SENTENCE HERE` = 2 hidden (before CAPS and SENTENCE, but not ALL or HERE).
3. **Every standalone caps word after the first gets a hidden token.** `(ARCTIC)`, `_ARCTIC`, `"ARCTIC"`, `IN ARCTIC`, `ARCTIC ARCTIC` — all consistently show 1 hidden token before the second caps word. The first caps word in the output never has one.
4. **The hidden token is likely a caps-mode shift marker.** The tokenizer appears to store uppercase words as their lowercase equivalents + a hidden "caps" prefix token. The first caps word doesn't need it (perhaps the tokenizer starts in a neutral/uppercase mode), but subsequent ones do. When caps letters are glued to lowercase (`aARCTIC`), the word can't be encoded as a single token, so it fragments into characters and no marker is needed.
5. **Leading/trailing whitespace has its own hidden tokens.** 2 hidden tokens appear with leading/trailing spaces — separate from caps markers. The model also refuses to reproduce the whitespace (end_turn with no new text), but those give-ups aren't real tokens.
6. **`GRÖSSE` breaks apart.** The caps + umlaut combo splits into `[ G][RÖ][SSE]` with 1 hidden token, suggesting the tokenizer treats uppercase non-ASCII differently.
7. **XML closing tags get a hidden token.** `<system>` has no hidden token but `</system>` does. The tokenizer likely stores close tags as the same token as open tags with a hidden "close" prefix — saving vocabulary space.
8. **Hidden tokens consume real `max_tokens` budget** (`stop_reason: "max_tokens"` with no visible output change), meaning they are genuine tokens in Claude's vocabulary that produce no printable characters.
