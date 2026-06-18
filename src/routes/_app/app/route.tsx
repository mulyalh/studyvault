import {
	createFileRoute,
	Outlet,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { requireSessionFn } from "@/modules/auth/auth.api";
import { getNotesFn, searchNotesFn } from "@/modules/note/note.api";
import {
	getNotebooksFn,
	createNotebookFn,
	updateNotebookFn,
	deleteNotebookFn,
} from "@/modules/notebook/notebook.api";
import { useState, useRef, useEffect, useCallback } from "react";
import { Sidebar } from "@/shared/components/sidebar/sidebar";
import { PanelLeftOpen } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

function AppSkeleton() {
	return (
		<div className="flex h-screen w-screen overflow-hidden bg-background">
			{/* Sidebar skeleton */}
			<div className="w-60 border-r border-border p-3 space-y-3 shrink-0">
				<Skeleton className="h-8 w-full" />
				<Skeleton className="h-4 w-3/4" />
				<div className="space-y-2 pt-4">
					{Array.from({ length: 6 }).map((_, i) => (
						<Skeleton key={i} className="h-7 w-full" />
					))}
				</div>
			</div>
			{/* Content skeleton */}
			<div className="flex-1 p-8 space-y-4">
				<Skeleton className="h-6 w-1/3" />
				<Skeleton className="h-4 w-full" />
				<Skeleton className="h-4 w-5/6" />
				<Skeleton className="h-4 w-2/3" />
			</div>
		</div>
	);
}

export const Route = createFileRoute("/_app/app")({
	beforeLoad: async () => {
		const session = await requireSessionFn();
		if (!session) {
			throw redirect({
				to: "/login",
			});
		}
	},
	loader: async () => {
		const [notes, notebooks] = await Promise.all([
			getNotesFn(),
			getNotebooksFn(),
		]);
		return { notes, notebooks };
	},
	pendingComponent: AppSkeleton,
	component: RouteComponent,
});

type SearchResult = {
	id: string;
	title: string;
	notebookId: string | null;
	snippet: string;
	updatedAt: Date;
};

function RouteComponent() {
	const { notes, notebooks: initialNotebooks } = Route.useLoaderData();
	const navigate = useNavigate();

	// Sidebar collapse state (lifted up so editor can expand)
	const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

	// Notebook management state
	const [notebooks, setNotebooks] = useState(initialNotebooks);
	const [isCreateNotebookOpen, setIsCreateNotebookOpen] = useState(false);
	const [notebookName, setNotebookName] = useState("");
	const [isCreatingNotebook, setIsCreatingNotebook] = useState(false);

	// Notebook delete confirmation state
	const [deleteConfirm, setDeleteConfirm] = useState<{
		notebookId: string;
		noteCount: number;
		notebookName: string;
	} | null>(null);
	const [isDeletingNotebook, setIsDeletingNotebook] = useState(false);

	// Search state
	const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
	const [_searching, setSearching] = useState(false);
	const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

	const handleCreateNote = (notebookId?: string | null) => {
		navigate({
			to: "/app/new",
			search: { notebookId: notebookId ?? undefined },
		});
	};

	const handleCreateNotebook = () => {
		setIsCreateNotebookOpen(true);
		setNotebookName("");
	};

	const handleSubmitCreateNotebook = async () => {
		if (!notebookName.trim()) return;

		setIsCreatingNotebook(true);
		try {
			const newNotebook = await createNotebookFn({
				data: { name: notebookName.trim() },
			});
			setNotebooks([...notebooks, { ...newNotebook, notes: [] }]);
			setIsCreateNotebookOpen(false);
			setNotebookName("");
		} catch (error) {
			console.error("Failed to create notebook:", error);
		} finally {
			setIsCreatingNotebook(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleSubmitCreateNotebook();
		} else if (e.key === "Escape") {
			setIsCreateNotebookOpen(false);
		}
	};

	const handleRenameNotebook = async (id: string, newName: string) => {
		if (!newName.trim()) return;
		try {
			const updated = await updateNotebookFn({
				data: { id, name: newName.trim() },
			});
			setNotebooks((prev) =>
				prev.map((nb) => (nb.id === id ? { ...nb, name: updated.name } : nb)),
			);
		} catch (error) {
			console.error("Failed to rename notebook:", error);
		}
	};

	const handleDeleteNotebook = async (
		id: string,
		noteCount: number,
		notebookName: string,
	) => {
		if (noteCount === 0) {
			try {
				await deleteNotebookFn({ data: { id, confirmDelete: true } });
				setNotebooks((prev) => prev.filter((nb) => nb.id !== id));
			} catch (error) {
				console.error("Failed to delete notebook:", error);
			}
			return;
		}

		setDeleteConfirm({ notebookId: id, noteCount, notebookName });
	};

	const handleConfirmDelete = async () => {
		if (!deleteConfirm) return;
		setIsDeletingNotebook(true);
		try {
			await deleteNotebookFn({
				data: {
					id: deleteConfirm.notebookId,
					confirmDelete: true,
				},
			});
			setNotebooks((prev) =>
				prev.filter((nb) => nb.id !== deleteConfirm.notebookId),
			);
			setDeleteConfirm(null);
		} catch (error) {
			console.error("Failed to delete notebook:", error);
		} finally {
			setIsDeletingNotebook(false);
		}
	};

	const handleSearch = useCallback(async (query: string) => {
		if (query.trim().length === 0) {
			setSearchResults([]);
			return;
		}
		setSearching(true);
		try {
			const results = await searchNotesFn({ data: { query: query.trim() } });
			setSearchResults(results as SearchResult[]);
		} catch {
			setSearchResults([]);
		} finally {
			setSearching(false);
		}
	}, []);

	const handleSearchChange = useCallback(
		(query: string) => {
			if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

			if (query.trim().length === 0) {
				setSearchResults([]);
				return;
			}

			searchDebounceRef.current = setTimeout(() => {
				handleSearch(query);
			}, 500);
		},
		[handleSearch],
	);

	// Cleanup debounce on unmount
	useEffect(() => {
		return () => {
			if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
		};
	}, []);

	return (
		<div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
			<Sidebar
				notebooks={notebooks}
				notes={notes}
				onCreateNote={handleCreateNote}
				onCreateNotebook={handleCreateNotebook}
				onRenameNotebook={handleRenameNotebook}
				onDeleteNotebook={handleDeleteNotebook}
				onSearch={handleSearchChange}
				searchResults={searchResults}
				isCollapsed={isSidebarCollapsed}
				onToggleCollapse={() => setIsSidebarCollapsed(true)}
			/>

			{/* Main Content Pane */}
			<main className="flex-1 flex flex-col overflow-hidden bg-background relative">
				{/* Expand sidebar button — shown only when sidebar is collapsed */}
				{isSidebarCollapsed && (
					<button
						type="button"
						onClick={() => setIsSidebarCollapsed(false)}
						title="Expand sidebar"
						className="absolute top-3 left-3 z-10 w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-foreground transition-colors cursor-pointer shadow-sm"
					>
						<PanelLeftOpen className="w-4 h-4" />
					</button>
				)}
				<Outlet />
			</main>

			{/* Create Notebook Dialog */}
			<Dialog
				open={isCreateNotebookOpen}
				onOpenChange={setIsCreateNotebookOpen}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create New Notebook</DialogTitle>
						<DialogDescription>
							Enter a name for your new notebook
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<Input
							placeholder="Notebook name..."
							value={notebookName}
							onChange={(e) => setNotebookName(e.target.value)}
							onKeyDown={handleKeyDown}
							disabled={isCreatingNotebook}
							autoFocus
						/>
						<div className="flex justify-end gap-2">
							<Button
								variant="outline"
								onClick={() => setIsCreateNotebookOpen(false)}
								disabled={isCreatingNotebook}
							>
								Cancel
							</Button>
							<Button
								onClick={handleSubmitCreateNotebook}
								disabled={isCreatingNotebook || !notebookName.trim()}
							>
								{isCreatingNotebook ? "Creating..." : "Create"}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Delete Notebook Confirmation Dialog */}
			<Dialog
				open={deleteConfirm !== null}
				onOpenChange={(open) => {
					if (!open) setDeleteConfirm(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Hapus Notebook</DialogTitle>
						<DialogDescription>
							Folder ini berisi {deleteConfirm?.noteCount ?? 0} catatan. Semua
							catatan akan dipindahkan ke Trash.
						</DialogDescription>
					</DialogHeader>
					<div className="flex justify-end gap-2">
						<Button
							variant="outline"
							onClick={() => setDeleteConfirm(null)}
							disabled={isDeletingNotebook}
						>
							Batal
						</Button>
						<Button
							variant="destructive"
							onClick={handleConfirmDelete}
							disabled={isDeletingNotebook}
						>
							{isDeletingNotebook ? "Menghapus..." : "Hapus"}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
