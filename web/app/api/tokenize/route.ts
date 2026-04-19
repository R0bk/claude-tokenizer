import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

const SYSTEM_PROMPT = `You are a precise text repeater. Your ONLY job is to repeat the user's text EXACTLY as given — same capitalization, same punctuation, same spacing. PRESERVE ALL CAPS, mixed case, and any unusual formatting exactly. Do not add anything before or after. Do not explain. Do not add quotes. Just output the exact text.`;

export async function POST(req: NextRequest) {
  const { text, apiKey, model } = await req.json();

  if (!text || typeof text !== "string") {
    return Response.json({ error: "text is required" }, { status: 400 });
  }

  if (text.length > 2000) {
    return Response.json(
      { error: "text must be under 2000 characters" },
      { status: 400 }
    );
  }

  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return Response.json(
      { error: "API key is required. Enter your Anthropic API key above." },
      { status: 401 }
    );
  }

  const client = new Anthropic({ apiKey: key });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const messages: Anthropic.MessageParam[] = [
        {
          role: "user",
          content: `Repeat this text exactly, character for character, preserving all capitalization and formatting. Output nothing else:\n${text}`,
        },
      ];

      let prevOutput = "";
      let n = 1;
      let consecutiveStalls = 0;
      let pendingHidden = 0;  // genuine hidden tokens (max_tokens stop with no new text)
      let pendingStalls = 0;  // model stubbornness (end_turn with no new text)
      let lastUsage = 0;      // cumulative output_tokens from previous call

      try {
        while (prevOutput.length < text.length) {
          const modelId = model || "claude-sonnet-4-20250514";
          const supportsTemperature = !modelId.startsWith("claude-opus-4-7");
          const response = await client.messages.create({
            model: modelId,
            max_tokens: n,
            ...(supportsTemperature ? { temperature: 0 } : {}),
            system: SYSTEM_PROMPT,
            messages,
          });

          const usage = response.usage?.output_tokens ?? 0;
          const usageDelta = Math.max(0, usage - lastUsage);
          lastUsage = usage;

          if (response.content.length === 0) {
            consecutiveStalls++;
            if (response.stop_reason === "max_tokens") {
              pendingHidden += usageDelta > 0 ? usageDelta : 1;
            } else if (usageDelta > 0) {
              pendingStalls += usageDelta;
            }
            if (consecutiveStalls > 5) break;
            n++;
            continue;
          }

          const block = response.content[0];
          if (block.type !== "text") break;

          const fullOutput = block.text;
          const newToken = fullOutput.slice(prevOutput.length);

          if (newToken === "") {
            consecutiveStalls++;
            if (response.stop_reason === "max_tokens") {
              pendingHidden += usageDelta > 0 ? usageDelta : 1;
            } else {
              pendingStalls += usageDelta > 0 ? usageDelta : 1;
            }
            if (consecutiveStalls > 5) break;
            n++;
            continue;
          }

          // Visible text appeared. Account for any extra tokens the API
          // billed beyond the single visible token we're about to emit —
          // those are hidden tokens that rode along with this call.
          if (usageDelta > 1) {
            pendingHidden += usageDelta - 1;
          }

          // Emit any accumulated hidden/stalled tokens before this visible one
          if (pendingHidden > 0 || pendingStalls > 0) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ hiddenTokens: pendingHidden, stalledTokens: pendingStalls })}\n\n`
              )
            );
            pendingHidden = 0;
            pendingStalls = 0;
          }

          consecutiveStalls = 0;
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ token: newToken, index: n - 1 })}\n\n`
            )
          );

          prevOutput = fullOutput;
          n++;

          if (n > text.length * 2) break;
        }

        // Trailing hidden tokens are still real — emit them
        // Trailing stalls are just the model giving up — drop them
        if (pendingHidden > 0) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ hiddenTokens: pendingHidden, stalledTokens: 0, trailing: true })}\n\n`
            )
          );
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ done: true, totalTokens: n - 1 })}\n\n`
          )
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`)
        );
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
