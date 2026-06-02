import { useMemo, useCallback, useState, useRef, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
	ChevronDown,
	ChevronRight,
	Folder,
	MoreVertical,
	Plus,
	FileText,
} from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SortOption } from "./sidebar";

interface Note {
	id: string;
	title: string;
	notebookId: string | null;
	updatedAt: Date;
}

interface NotebookType {
	id: string;
	name: string;
	notes: Note[];
	updatedAt: Date;
}

interface SidebarFileTreeProps {
	notebooks: (NotebookType & { notes: Note[] })[];
	notes: Note[];
	sortBy: SortOption;
	expandedNotebooks: Set<string>;
	onToggleNotebook: (notebookId: string) => void;
	onCreateNote: (notebookId?: string | null) => void;
	onRenameNotebook: (id: string, newName: string) => Promise<void>;
	onDeleteNotebook: (
		id: string,
		noteCount: number,
		notebookName: string,
	) => void;
}

export function SidebarFileTree({
	notebooks,
	notes,
	sortBy,
	expandedNotebooks,
	onToggleNotebook,
	onCreateNote,
	onRenameNotebook,
	onDeleteNotebook,
}: SidebarFileTreeProps) {
	const [renamingNotebookId, setRenamingNotebookId] = useState<string | null>(
		null,
	);
	const [renamingValue, setRenamingValue] = useState("");
	const renameInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (renamingNotebookId && renameInputRef.current) {
			renameInputRef.current.focus();
			renameInputRef.current.select();
		}
	}, [renamingNotebookId]);

	const startRenaming = useCallback((id: string, currentName: string) => {
		setRenamingNotebookId(id);
		setRenamingValue(currentName);
	}, []);

	const confirmRename = useCallback(
		async (id: string) => {
			const trimmed = renamingValue.trim();
			if (trimmed && trimmed !== notebooks.find((n) => n.id === id)?.name) {
				await onRenameNotebook(id, trimmed);
			}
			setRenamingNotebookId(null);
			setRenamingValue("");
		},
		[renamingValue, notebooks, onRenameNotebook],
	);

	const cancelRename = useCallback(() => {
		setRenamingNotebookId(null);
		setRenamingValue("");
	}, []);

	// Sort function for notes
	const sortNoteItems = useCallback(
		(items: Note[]) => {
			const sorted = [...items];
			switch (sortBy) {
				case "a-z":
					return sorted.sort((a, b) => a.title.localeCompare(b.title));
				case "z-a":
					return sorted.sort((a, b) => b.title.localeCompare(a.title));
				case "oldest":
					return sorted.sort(
						(a, b) =>
							new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
					);
				default:
					return sorted.sort(
						(a, b) =>
							new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
					);
			}
		},
		[sortBy],
	);

	// Sort function for notebooks
	const sortNotebookItems = useCallback(
		(items: NotebookType[]) => {
			const sorted = [...items];
			switch (sortBy) {
				case "a-z":
					return sorted.sort((a, b) => a.name.localeCompare(b.name));
				case "z-a":
					return sorted.sort((a, b) => b.name.localeCompare(a.name));
				case "oldest":
					return sorted.sort(
						(a, b) =>
							new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
					);
				default:
					return sorted.sort(
						(a, b) =>
							new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
					);
			}
		},
		[sortBy],
	);

	const sortedNotebooks = useMemo(
		() => sortNotebookItems(notebooks),
		[notebooks, sortNotebookItems],
	);

	const sortedRootNotes = useMemo(
		() => sortNoteItems(notes.filter((note) => !note.notebookId)),
		[notes, sortNoteItems],
	);

	return (
		<div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
			{/* Inbox Section */}
			<div>
				{/* Inbox Notes */}
				{sortedRootNotes.length > 0 && (
					<nav className="ml-2 space-y-0.5 border-l border-zinc-200 dark:border-zinc-800 mt-0.5">
						{sortedRootNotes.map((note) => (
							<Link
								key={note.id}
								to="/app/$noteId"
								params={{ noteId: note.id }}
								activeProps={{
									className:
										"bg-zinc-200/60 dark:bg-zinc-800/60 text-foreground font-semibold border-l-2 border-primary",
								}}
								inactiveProps={{
									className:
										"text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-foreground",
								}}
								className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-100 group border-l-2 border-transparent ml-1"
							>
								<FileText className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
								<span className="truncate flex-1">
									{note.title || "Untitled"}
								</span>
							</Link>
						))}
					</nav>
				)}
			</div>

			{/* Notebooks without section headers */}
			{sortedNotebooks.length > 0 && (
				<nav className="space-y-1">
					{sortedNotebooks.map((notebook) => (
						<div key={notebook.id}>
							<div
								data-notebook-id={notebook.id}
								className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors group"
							>
								<button
									type="button"
									onClick={() => onToggleNotebook(notebook.id)}
									className="flex items-center justify-center w-4 h-4 text-muted-foreground hover:text-foreground transition-colors cursor-pointer -ml-1"
								>
									{expandedNotebooks.has(notebook.id) ? (
										<ChevronDown className="w-3.5 h-3.5" />
									) : (
										<ChevronRight className="w-3.5 h-3.5" />
									)}
								</button>
								<Folder className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
								{renamingNotebookId === notebook.id ? (
									<input
										ref={renameInputRef}
										type="text"
										value={renamingValue}
										onChange={(e) => setRenamingValue(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault();
												confirmRename(notebook.id);
											} else if (e.key === "Escape") {
												cancelRename();
											}
										}}
										onBlur={() => cancelRename()}
										className="flex-1 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 border border-border rounded px-1.5 py-0.5 text-foreground outline-none focus:ring-1 focus:ring-primary/50 min-w-0"
									/>
								) : (
									<span
										role="button"
										tabIndex={0}
										className="flex-1 text-xs font-medium text-foreground truncate text-left cursor-pointer"
										onDoubleClick={() =>
											startRenaming(notebook.id, notebook.name)
										}
									>
										{notebook.name}
									</span>
								)}
								<span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-200 dark:bg-zinc-800 text-muted-foreground group-hover:bg-zinc-300 dark:group-hover:bg-zinc-700 transition-colors">
									{notebook.notes.length}
								</span>
								<button
									type="button"
									onClick={(e) => {
										e.preventDefault();
										onCreateNote(notebook.id);
									}}
									title="Add note to notebook"
									className="flex items-center justify-center w-5 h-5 text-muted-foreground hover:text-foreground transition-colors rounded opacity-0 group-hover:opacity-100 cursor-pointer"
								>
									<Plus className="w-3.5 h-3.5" />
								</button>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<button
											type="button"
											className="flex items-center justify-center w-5 h-5 text-muted-foreground hover:text-foreground transition-colors rounded opacity-0 group-hover:opacity-100 cursor-pointer"
										>
											<MoreVertical className="w-3.5 h-3.5" />
										</button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end" className="w-40">
										<DropdownMenuItem
											onClick={() => startRenaming(notebook.id, notebook.name)}
										>
											Rename
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={() =>
												onDeleteNotebook(
													notebook.id,
													notebook.notes.length,
													notebook.name,
												)
											}
											className="text-red-600 dark:text-red-400"
										>
											Delete
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>

							{/* Nested Notes */}
							{expandedNotebooks.has(notebook.id) &&
								notebook.notes.length > 0 && (
									<nav className="ml-2 space-y-0.5 border-l border-zinc-200 dark:border-zinc-800 mt-0.5">
										{sortNoteItems(notebook.notes).map((note) => (
											<Link
												key={note.id}
												to="/app/$noteId"
												params={{ noteId: note.id }}
												activeProps={{
													className:
														"bg-zinc-200/60 dark:bg-zinc-800/60 text-foreground font-semibold border-l-2 border-primary",
												}}
												inactiveProps={{
													className:
														"text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-foreground",
												}}
												className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-100 group border-l-2 border-transparent ml-1"
											>
												<FileText className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
												<span className="truncate flex-1">
													{note.title || "Untitled"}
												</span>
											</Link>
										))}
									</nav>
								)}
						</div>
					))}
				</nav>
			)}

			{/* Empty State */}
			{sortedNotebooks.length === 0 && sortedRootNotes.length === 0 && (
				<div className="px-3 py-8 text-center text-xs text-muted-foreground/75 italic">
					No notebooks or notes yet
				</div>
			)}
		</div>
	);
}
