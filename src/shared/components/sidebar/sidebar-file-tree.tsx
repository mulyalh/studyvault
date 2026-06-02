import { useMemo, useCallback } from "react";
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
}

export function SidebarFileTree({
	notebooks,
	notes,
	sortBy,
	expandedNotebooks,
	onToggleNotebook,
	onCreateNote,
}: SidebarFileTreeProps) {
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
								<span className="flex-1 text-xs font-medium text-foreground truncate text-left">
									{notebook.name}
								</span>
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
											onClick={() => {
												// TODO: Implement rename notebook
												console.log("Rename notebook:", notebook.id);
											}}
										>
											Rename
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={() => {
												// TODO: Implement edit notebook
												console.log("Edit notebook:", notebook.id);
											}}
										>
											Edit
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={() => {
												// TODO: Implement delete notebook
												console.log("Delete notebook:", notebook.id);
											}}
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
