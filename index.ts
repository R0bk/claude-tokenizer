import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const input = process.argv.slice(2).join(" ");

if (!input) {
  console.error("Usage: npm run tokenize -- <text to tokenize>");
  console.error(
    'Example: npm run tokenize -- "Security by obscurity is not a good idea."'
  );
  process.exit(1);
}

const SYSTEM_PROMPT = `You are a precise text repeater. Your ONLY job is to repeat the user's text EXACTLY as given. Do not add anything before or after. Do not explain. Do not add quotes. Just output the exact text.`;

const USER_PROMPT = (text: string) =>
  `Repeat this text exactly, character for character. Output nothing else:\n${text}`;

async function tokenize(text: string) {
  const tokens: string[] = [];
  let prevOutput = "";
  let n = 1;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: USER_PROMPT(text) },
  ];

  process.stdout.write("\nExtracting tokens");

  while (prevOutput.length < text.length) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: n,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages,
    });

    if (response.content.length === 0) break;

    const block = response.content[0];
    if (block.type !== "text") break;

    const fullOutput = block.text;

    // The new token is the diff between this output and previous
    const newToken = fullOutput.slice(prevOutput.length);
    if (newToken === "") break;

    tokens.push(newToken);
    prevOutput = fullOutput;
    n++;

    process.stdout.write(".");

    // Safety valve
    if (n > text.length * 2) break;
  }

  console.log(" done!\n");

  // Display results
  console.log("┌─────────────────────────────────────");
  console.log("│ Claude Tokenizer");
  console.log("├─────────────────────────────────────");
  console.log(`│ Input:  "${text}"`);
  console.log("├─────────────────────────────────────");
  console.log(`│ Tokens (${tokens.length} exact tokens):`);
  console.log("│");
  console.log(`│  [${tokens.map((t) => JSON.stringify(t)).join(" | ")}]`);
  console.log("│");
  console.log("├─────────────────────────────────────");
  console.log("│ Visual split:");
  console.log("│");
  console.log(`│  ${tokens.join("│")}`);
  console.log("│");
  console.log("├─────────────────────────────────────");
  console.log(`│ API calls: ${n - 1}`);
  console.log("└─────────────────────────────────────\n");
}

tokenize(input);
