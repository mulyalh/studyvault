import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { dbMiddleware } from "@/shared/middleware/db.middleware";
import { auth } from "@/shared/lib/auth";
import { getSummarySchema, generateSummarySchema } from "./ai.schema";
import OpenAI from "openai";

// Helper to get session and throw if unauthenticated
async function requireSession() {
	try {
		const session = await auth.api.getSession({
			headers: getRequestHeaders(),
		});
		if (!session) {
			throw new Error("Unauthenticated");
		}
		return session;
	} catch {
		throw new Error("Unauthenticated");
	}
}

// Lightweight djb2-style hash for content comparison
function hashContent(content: string): string {
	let hash = 5381;
	for (let i = 0; i < content.length; i++) {
		hash = ((hash << 5) + hash) ^ content.charCodeAt(i);
		hash = hash >>> 0; // keep as 32-bit unsigned int
	}
	return hash.toString(16);
}

// Count words in plain text
function getWordCount(text: string): number {
	return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

// Structure of the AI-generated summary
export interface AISummaryContent {
	takeaway: string;
	keyConcepts: string[];
	recallHooks: string[];
}

/** GET: Returns cached AISummary for a note or null */
export const getSummaryFn = createServerFn({ method: "GET" })
	.middleware([dbMiddleware])
	.inputValidator(getSummarySchema)
	.handler(async ({ context, data }) => {
		const session = await requireSession();

		// Verify note ownership
		const note = await context.db.note.findFirst({
			where: { id: data.noteId, userId: session.user.id },
			select: { id: true, wordCount: true },
		});

		if (!note) {
			throw new Error("Note not found or access denied");
		}

		const summary = await context.db.aISummary.findUnique({
			where: { noteId: data.noteId },
		});

		return summary ?? null;
	});

/** POST: Generate (or regenerate) AI summary for a note */
export const generateSummaryFn = createServerFn({ method: "POST" })
	.middleware([dbMiddleware])
	.inputValidator(generateSummarySchema)
	.handler(async ({ context, data }) => {
		const session = await requireSession();

		// Verify note ownership
		const note = await context.db.note.findFirst({
			where: { id: data.noteId, userId: session.user.id },
			select: { id: true },
		});

		if (!note) {
			throw new Error("Note not found or access denied");
		}

		const wordCount = getWordCount(data.content);
		if (wordCount < 150) {
			throw new Error("Note must have at least 150 words for AI summary");
		}

		const contentHash = hashContent(data.content);

		// Mark as GENERATING immediately (preserves old content if any)
		await context.db.aISummary.upsert({
			where: { noteId: data.noteId },
			create: {
				noteId: data.noteId,
				content: "",
				generatedAt: new Date(),
				basedOnHash: contentHash,
				status: "GENERATING",
			},
			update: {
				status: "GENERATING",
				basedOnHash: contentHash,
			},
		});

		const apiKey =
			process.env.OPENAI_API_KEY ||
			"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";
		if (!apiKey) {
			await context.db.aISummary.update({
				where: { noteId: data.noteId },
				data: { status: "FAILED" },
			});
			throw new Error("OPENAI_API_KEY is not configured");
		}

		try {
			const openai = new OpenAI({
				apiKey,
				baseURL: "https://integrate.api.nvidia.com/v1",
			});

			const response = await openai.chat.completions.create({
				model: "minimaxai/minimax-m2.7",
				temperature: 0.4,
				max_tokens: 600,
				messages: [
					{
						role: "system",
						content: `You are a study assistant that analyzes notes and returns a structured JSON summary.
Always respond with valid JSON in this exact format:
{
  "takeaway": "A single concise sentence summarizing the core insight.",
  "keyConcepts": ["concept 1", "concept 2", "concept 3"],
  "recallHooks": ["A recall question or hook", "Another recall hook"]
}
- "takeaway": 1 sentence, the most important point.
- "keyConcepts": 3–6 key terms or ideas from the note.
- "recallHooks": 2–4 questions or prompts to help the user recall the material.
Respond ONLY with valid JSON, no markdown, no extra text.`,
					},
					{
						role: "user",
						content: `Here are my study notes. Please summarize them and response using language their write:\n\n${data.content}`,
					},
				],
			});

			const rawContent = response.choices?.[0]?.message?.content ?? "";

			let summaryContent: AISummaryContent;
			try {
				summaryContent = JSON.parse(rawContent);
			} catch {
				throw new Error("Failed to parse AI response as JSON");
			}

			// Upsert with FRESH status
			const updated = await context.db.aISummary.upsert({
				where: { noteId: data.noteId },
				create: {
					noteId: data.noteId,
					content: JSON.stringify(summaryContent),
					generatedAt: new Date(),
					basedOnHash: contentHash,
					status: "FRESH",
				},
				update: {
					content: JSON.stringify(summaryContent),
					generatedAt: new Date(),
					basedOnHash: contentHash,
					status: "FRESH",
				},
			});

			return updated;
		} catch (error) {
			// Preserve old content on failure, just mark as FAILED
			await context.db.aISummary.update({
				where: { noteId: data.noteId },
				data: { status: "FAILED" },
			});
			throw error;
		}
	});

/** Helper to check if a content change is significant enough to trigger regen */
export function isSignificantChange(
	newContent: string,
	oldHash: string,
	oldWordCount: number,
): boolean {
	const newHash = hashContent(newContent);
	if (newHash === oldHash) return false; // no change at all

	const newWordCount = getWordCount(newContent);
	// Minor change threshold: less than 5 words difference
	if (Math.abs(newWordCount - oldWordCount) < 5) return false;

	return true;
}
