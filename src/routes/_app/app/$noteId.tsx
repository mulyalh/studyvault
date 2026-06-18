import {
	createFileRoute,
	redirect,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { requireSessionFn } from "@/modules/auth/auth.api";
import { useState, useEffect, useRef, useCallback } from "react";
import {
	getNoteByIdFn,
	updateNoteFn,
	deleteNoteFn,
} from "@/modules/note/note.api";
import {
	FileText,
	Trash2,
	CheckCircle2,
	Loader2,
	AlertCircle,
	BookOpen,
	HelpCircle,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Editor } from "@/modules/note/components/editor";
import { AISummarySidebar } from "@/modules/ai/components/ai-summary-sidebar";
import { getSummaryFn, generateSummaryFn } from "@/modules/ai/ai.api";
import { Skeleton } from "@/components/ui/skeleton";

function NoteSkeleton() {
	return (
		<div className="flex-1 flex h-full overflow-hidden bg-background">
			<div className="flex-1 flex flex-col h-full border-r border-border">
				<header className="h-14 border-b border-border px-6 flex items-center bg-card">
					<div className="flex items-center gap-2">
						<Skeleton className="h-4 w-4" />
						<Skeleton className="h-4 w-32" />
					</div>
				</header>
				<div className="flex-1 p-8 lg:p-12 xl:p-16 max-w-2xl w-full mx-auto space-y-6">
					<Skeleton className="h-9 w-2/3" />
					<div className="space-y-3 pt-4">
						{Array.from({ length: 8 }).map((_, i) => (
							<Skeleton key={i} className="h-3.5 w-full" />
						))}
						<Skeleton className="h-3.5 w-3/4" />
						<Skeleton className="h-3.5 w-1/2" />
					</div>
				</div>
			</div>
			{/* AI sidebar skeleton */}
			<div className="hidden xl:flex w-72 border-l border-border p-4 space-y-4 shrink-0">
				<div className="space-y-3 w-full">
					<Skeleton className="h-5 w-1/2" />
					<Skeleton className="h-20 w-full rounded-xl" />
					<Skeleton className="h-24 w-full rounded-xl" />
					<Skeleton className="h-16 w-full rounded-xl" />
				</div>
			</div>
		</div>
	);
}

function hashContent(content: string): string {
	let hash = 5381;
	for (let i = 0; i < content.length; i++) {
		hash = ((hash << 5) + hash) ^ content.charCodeAt(i);
		hash = hash >>> 0;
	}
	return hash.toString(16);
}

function getWordCount(text: string): number {
	return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

export const Route = createFileRoute("/_app/app/$noteId")({
	beforeLoad: async () => {
		const session = await requireSessionFn();
		if (!session) {
			throw redirect({ to: "/login" });
		}
	},
	loader: async ({ params }) => {
		const note = await getNoteByIdFn({ data: { id: params.noteId } });
		if (!note) {
			throw redirect({ to: "/app" });
		}
		return { note };
	},
	pendingComponent: NoteSkeleton,
	component: RouteComponent,
});

function RouteComponent() {
	const { note } = Route.useLoaderData();
	const navigate = useNavigate();
	const router = useRouter();

	const [title, setTitle] = useState(note.title);
	const [content, setContent] = useState(note.content);
	const [saveStatus, setSaveStatus] = useState<
		"saved" | "saving" | "error" | "idle"
	>("idle");
	const saveTimeout = useRef<NodeJS.Timeout | null>(null);
	const savedIndicatorTimeout = useRef<NodeJS.Timeout | null>(null);
	const pendingSaveData = useRef<{ title: string; content: string } | null>(
		null,
	);

	const [isTyping, setIsTyping] = useState(false);
	const typingTimeout = useRef<NodeJS.Timeout | null>(null);

	const [wordCount, setWordCount] = useState(getWordCount(note.content));

	const lastRegenHashRef = useRef<string | null>(null);
	const lastRegenWordCountRef = useRef<number>(getWordCount(note.content));

	useEffect(() => {
		setTitle(note.title);
		setContent(note.content);
		setSaveStatus("idle");
		setWordCount(getWordCount(note.content));
		pendingSaveData.current = null;
		lastRegenHashRef.current = null;
		lastRegenWordCountRef.current = getWordCount(note.content);
	}, [note.content, note.title]);

	const checkAndRegenIfStale = useCallback(
		async (savedContent: string) => {
			const currentWordCount = getWordCount(savedContent);
			if (currentWordCount < 150) return;

			try {
				const existingSummary = await getSummaryFn({
					data: { noteId: note.id },
				});

				if (!existingSummary) {
					if (lastRegenHashRef.current === null) {
						lastRegenHashRef.current = hashContent(savedContent);
						lastRegenWordCountRef.current = currentWordCount;
						await generateSummaryFn({
							data: { noteId: note.id, content: savedContent },
						});
					}
					return;
				}

				if (
					existingSummary.status === "GENERATING" ||
					existingSummary.status === "STALE"
				) {
					return;
				}

				const newHash = hashContent(savedContent);
				const oldHash = existingSummary.basedOnHash;
				const oldWordCount = lastRegenWordCountRef.current;

				if (
					newHash === oldHash ||
					Math.abs(currentWordCount - oldWordCount) < 5
				) {
					return;
				}

				lastRegenHashRef.current = newHash;
				lastRegenWordCountRef.current = currentWordCount;
				await generateSummaryFn({
					data: { noteId: note.id, content: savedContent },
				});
			} catch {
				// non-critical
			}
		},
		[note.id],
	);

	const performSave = useCallback(
		async (updatedTitle: string, updatedContent: string) => {
			setSaveStatus("saving");
			try {
				await updateNoteFn({
					data: {
						id: note.id,
						title: updatedTitle,
						content: updatedContent,
					},
				});
				setSaveStatus("saved");
				pendingSaveData.current = null;

				if (savedIndicatorTimeout.current)
					clearTimeout(savedIndicatorTimeout.current);
				savedIndicatorTimeout.current = setTimeout(() => {
					setSaveStatus((prev) => (prev === "saved" ? "idle" : prev));
				}, 2000);

				await router.invalidate();
				void checkAndRegenIfStale(updatedContent);
			} catch (error) {
				console.error("Auto-save failed", error);
				setSaveStatus("error");
			}
		},
		[note.id, router, checkAndRegenIfStale],
	);

	function deriveTitle(markdownContent: string): string {
		const lines = markdownContent.split("\n");
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			const h1Match = trimmed.match(/^#\s+(.+)/);
			if (h1Match) return h1Match[1].trim();
			const stripped = trimmed.replace(/^#{1,6}\s+/, "").trim();
			if (stripped) return stripped;
		}
		return "";
	}

	const handleChange = (newTitle: string, newContent: string) => {
		const effectiveTitle =
			newTitle.trim() !== "" ? newTitle : deriveTitle(newContent);

		setTitle(newTitle);
		setContent(newContent);
		setWordCount(getWordCount(newContent));
		pendingSaveData.current = { title: effectiveTitle, content: newContent };

		setIsTyping(true);
		if (typingTimeout.current) clearTimeout(typingTimeout.current);
		typingTimeout.current = setTimeout(() => {
			setIsTyping(false);
		}, 600);

		if (saveStatus !== "error") {
			setSaveStatus("saving");
		}

		if (saveTimeout.current) {
			clearTimeout(saveTimeout.current);
		}

		saveTimeout.current = setTimeout(() => {
			if (pendingSaveData.current) {
				performSave(
					pendingSaveData.current.title,
					pendingSaveData.current.content,
				);
			}
		}, 1500);
	};

	useEffect(() => {
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			if (
				pendingSaveData.current ||
				saveStatus === "saving" ||
				saveStatus === "error"
			) {
				e.preventDefault();
				e.returnValue = "";
			}
		};
		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [saveStatus]);

	useEffect(() => {
		const handleOnline = () => {
			if (saveStatus === "error" && pendingSaveData.current) {
				performSave(
					pendingSaveData.current.title,
					pendingSaveData.current.content,
				);
			}
		};
		window.addEventListener("online", handleOnline);
		return () => window.removeEventListener("online", handleOnline);
	}, [saveStatus, performSave]);

	useEffect(() => {
		return () => {
			if (saveTimeout.current) clearTimeout(saveTimeout.current);
			if (savedIndicatorTimeout.current)
				clearTimeout(savedIndicatorTimeout.current);
			if (typingTimeout.current) clearTimeout(typingTimeout.current);
		};
	}, []);

	const handleRetry = () => {
		if (pendingSaveData.current) {
			performSave(
				pendingSaveData.current.title,
				pendingSaveData.current.content,
			);
		} else {
			performSave(title, content);
		}
	};

	const handleSoftDelete = async () => {
		try {
			await deleteNoteFn({ data: { id: note.id } });
			await router.invalidate();
			navigate({ to: "/app" });
		} catch (error) {
			console.error("Failed to delete note", error);
		}
	};

	return (
		<div className="flex-1 flex h-full overflow-hidden bg-background">
			<div className="flex-1 flex flex-col h-full border-r border-border">
				{/* Breadcrumb (US-ED-NAV-01) + Action Buttons (US-ED-NAV-03) */}
				<header className="h-14 border-b border-border px-6 flex items-center justify-between bg-card">
					<div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium min-w-0">
						<FileText className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
						{note.notebook ? (
							<>
								<button
									type="button"
									onClick={() => {
										window.dispatchEvent(
											new CustomEvent("focus-notebook", {
												detail: note.notebook.id,
											}),
										);
									}}
									className="hover:text-foreground transition-colors cursor-pointer truncate max-w-28"
								>
									{note.notebook.name}
								</button>
								<span className="text-muted-foreground/40 select-none">›</span>
							</>
						) : null}
						<span className="truncate max-w-45 font-semibold text-foreground">
							{title || "Untitled"}
						</span>
					</div>

					<div className="flex items-center gap-1.5">
						<div className="text-[11px] flex items-center h-8">
							{saveStatus === "saved" && (
								<span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-500 font-medium animate-in fade-in duration-300">
									<CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
									Saved
								</span>
							)}
							{saveStatus === "saving" && (
								<span className="flex items-center gap-1.5 text-muted-foreground font-medium animate-in fade-in duration-300">
									<Loader2 className="w-3 h-3 animate-spin shrink-0" />
									Saving...
								</span>
							)}
							{saveStatus === "error" && (
								<button
									type="button"
									onClick={handleRetry}
									className="flex items-center gap-1.5 text-rose-500 font-medium hover:bg-rose-500/10 px-2 py-1 rounded-md transition-colors cursor-pointer animate-in fade-in duration-300"
									title="Click to retry saving"
								>
									<AlertCircle className="w-3.5 h-3.5 shrink-0" />
									Save failed - Retry
								</button>
							)}
						</div>

						<div className="flex items-center gap-1">
							<Button
								variant="ghost"
								size="icon-sm"
								disabled={wordCount < 150}
								title={
									wordCount < 150
										? "Minimal 150 kata untuk menggunakan fitur AI"
										: "Generate Flashcard"
								}
								className="text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
							>
								<BookOpen className="w-3.5 h-3.5" />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								disabled={wordCount < 150}
								title={
									wordCount < 150
										? "Minimal 150 kata untuk menggunakan fitur AI"
										: "Generate Review Question"
								}
								className="text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
							>
								<HelpCircle className="w-3.5 h-3.5" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								onClick={handleSoftDelete}
								className="text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg w-8 h-8 flex items-center justify-center transition-colors cursor-pointer"
								title="Move to Trash"
							>
								<Trash2 className="w-3.5 h-3.5" />
							</Button>
						</div>
					</div>
				</header>

				<div className="flex-1 overflow-y-auto p-8 lg:p-12 xl:p-16 max-w-2xl w-full mx-auto flex flex-col space-y-6">
					<input
						type="text"
						value={title}
						onChange={(e) => handleChange(e.target.value, content)}
						placeholder="Untitled"
						className="w-full bg-transparent border-0 outline-none text-3xl font-bold text-foreground placeholder:text-muted-foreground/30 select-none tracking-tight font-sans"
					/>
					<Editor
						content={content || ""}
						onChange={(newContent) => handleChange(title, newContent)}
						placeholder="Start writing..."
					/>
				</div>

				{/* Stats Bar (US-ED-NAV-02) */}
				<div className="h-8 border-t border-border px-6 flex items-center justify-end gap-3 text-[11px] text-muted-foreground bg-card shrink-0">
					<span>0 backlinks</span>
					<span className="text-muted-foreground/30">·</span>
					<span>
						{wordCount} {wordCount === 1 ? "word" : "words"}
					</span>
					<span className="text-muted-foreground/30">·</span>
					<span>{content.length} chars</span>
					<span className="text-muted-foreground/30">·</span>
					<span>{Math.ceil(wordCount / 200)} min read</span>
				</div>
			</div>

			<div className="hidden xl:flex">
				<AISummarySidebar
					noteId={note.id}
					wordCount={wordCount}
					isTyping={isTyping}
					contentForRegen={content}
					onRegenRequested={() => {
						lastRegenHashRef.current = hashContent(content);
						lastRegenWordCountRef.current = wordCount;
					}}
				/>
			</div>
		</div>
	);
}
