import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { requireSessionFn } from "@/modules/auth/auth.api";
import {
	getTrashNotesFn,
	restoreNoteFn,
	permanentDeleteNoteFn,
} from "@/modules/note/note.api";
import { Trash2, RotateCcw, Info, FileText } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

export const Route = createFileRoute("/_app/app/trash")({
	beforeLoad: async () => {
		const session = await requireSessionFn();
		if (!session) {
			throw redirect({ to: "/login" });
		}
	},
	loader: async () => {
		const trashNotes = await getTrashNotesFn();
		return { trashNotes };
	},
	component: RouteComponent,
});

function RouteComponent() {
	const { trashNotes } = Route.useLoaderData();
	const router = useRouter();

	const handleRestore = async (id: string) => {
		try {
			await restoreNoteFn({ data: { id } });
			await router.invalidate();
		} catch (error) {
			console.error("Failed to restore note", error);
		}
	};

	const handlePermanentDelete = async (id: string) => {
		if (
			window.confirm(
				"Are you absolutely sure you want to permanently delete this note? This action is irreversible.",
			)
		) {
			try {
				await permanentDeleteNoteFn({ data: { id } });
				await router.invalidate();
			} catch (error) {
				console.error("Failed to permanently delete note", error);
			}
		}
	};

	return (
		<div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
			{/* Top Bar */}
			<header className="h-14 border-b border-border px-6 flex items-center bg-card">
				<div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
					<Trash2 className="w-3.5 h-3.5 text-rose-500" />
					<span>Trash / Deleted Notes</span>
				</div>
			</header>

			{/* Content Body */}
			<div className="flex-1 overflow-y-auto p-6 lg:p-10 max-w-2xl w-full mx-auto space-y-6">
				<div className="flex items-start gap-3 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-amber-800 dark:text-amber-200 text-xs">
					<Info className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
					<p className="leading-relaxed">
						Notes in the trash have been soft-deleted. You can restore them to
						recover your work, or permanently delete them. Permanent deletion is
						irreversible and will remove all contents and associated AI
						summaries forever.
					</p>
				</div>

				{trashNotes.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
						<div className="w-12 h-12 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-border flex items-center justify-center shadow-xs">
							<Trash2 className="w-5 h-5 text-muted-foreground/30" />
						</div>
						<div className="space-y-1">
							<h3 className="font-semibold text-sm text-foreground">
								Trash is Empty
							</h3>
							<p className="text-muted-foreground text-xs">
								No soft-deleted notes found.
							</p>
						</div>
					</div>
				) : (
					<div className="grid gap-3">
						{trashNotes.map((note) => (
							<div
								key={note.id}
								className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-all duration-150 shadow-xs group"
							>
								{/* Info */}
								<div className="flex items-center gap-3.5 min-w-0">
									<div className="w-9 h-9 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-border flex items-center justify-center flex-shrink-0">
										<FileText className="w-4 h-4 text-muted-foreground/60" />
									</div>
									<div className="min-w-0">
										<h4 className="font-semibold text-xs text-foreground truncate">
											{note.title || "Untitled Note"}
										</h4>
										<p className="text-[10px] text-muted-foreground mt-0.5 truncate">
											Deleted at{" "}
											{note.deletedAt
												? new Date(note.deletedAt).toLocaleDateString()
												: "-"}{" "}
											at{" "}
											{note.deletedAt
												? new Date(note.deletedAt).toLocaleTimeString()
												: "-"}
										</p>
									</div>
								</div>

								{/* Actions */}
								<div className="flex items-center gap-1.5">
									<Button
										variant="ghost"
										size="icon"
										onClick={() => handleRestore(note.id)}
										className="w-8.5 h-8.5 text-zinc-500 hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition-all cursor-pointer"
										title="Restore Note"
									>
										<RotateCcw className="w-3.5 h-3.5" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										onClick={() => handlePermanentDelete(note.id)}
										className="w-8.5 h-8.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
										title="Delete Permanently"
									>
										<Trash2 className="w-3.5 h-3.5" />
									</Button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
