import { useState, useCallback, useEffect } from "react";
import { SidebarHeader } from "./sidebar-header";
import { SidebarActionBar } from "./sidebar-action-bar";
import { SidebarFileTree } from "./sidebar-file-tree";
import { SidebarFooter } from "./sidebar-footer";

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

export type SortOption = "newest" | "oldest" | "a-z" | "z-a";

interface SidebarProps {
	notebooks: (NotebookType & { notes: Note[] })[];
	notes: Note[];
	onCreateNote: (notebookId?: string | null) => void;
	onCreateNotebook?: () => void;
	onRenameNotebook: (id: string, newName: string) => Promise<void>;
	onDeleteNotebook: (
		id: string,
		noteCount: number,
		notebookName: string,
	) => void;
	onSearch?: (query: string) => void;
	searchResults?: Note[];
	isCollapsed: boolean;
	onToggleCollapse: () => void;
	user?: {
		name?: string | null;
		email?: string | null;
	} | null;
}

export function Sidebar({
	notebooks,
	notes,
	onCreateNote,
	onCreateNotebook,
	onRenameNotebook,
	onDeleteNotebook,
	onSearch,
	searchResults,
	isCollapsed,
	onToggleCollapse,
	user,
}: SidebarProps) {
	const [expandedNotebooks, setExpandedNotebooks] = useState<Set<string>>(
		new Set(),
	);
	const [sortBy, setSortBy] = useState<SortOption>("newest");

	const toggleNotebook = useCallback((notebookId: string) => {
		setExpandedNotebooks((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(notebookId)) {
				newSet.delete(notebookId);
			} else {
				newSet.add(notebookId);
			}
			return newSet;
		});
	}, []);

	const collapseAll = useCallback(() => {
		setExpandedNotebooks(new Set());
	}, []);

	useEffect(() => {
		const handler = (e: CustomEvent<string>) => {
			const notebookId = e.detail;
			setExpandedNotebooks((prev) => {
				if (prev.has(notebookId)) return prev;
				return new Set([...prev, notebookId]);
			});
			requestAnimationFrame(() => {
				const el = document.querySelector(`[data-notebook-id="${notebookId}"]`);
				if (el) {
					el.scrollIntoView({ behavior: "smooth", block: "center" });
					el.classList.add(
						"ring-2",
						"ring-primary/40",
						"rounded-lg",
						"transition-all",
						"duration-700",
					);
					setTimeout(() => {
						el.classList.remove(
							"ring-2",
							"ring-primary/40",
							"rounded-lg",
							"transition-all",
							"duration-700",
						);
					}, 2000);
				}
			});
		};
		window.addEventListener("focus-notebook", handler as EventListener);
		return () =>
			window.removeEventListener("focus-notebook", handler as EventListener);
	}, []);

	if (isCollapsed) {
		return null;
	}

	return (
		<aside className="w-65 flex flex-col border-r border-border bg-zinc-50 dark:bg-zinc-950 shrink-0">
			<SidebarHeader onToggleCollapse={onToggleCollapse} />

			<SidebarActionBar
				onCreateNote={() => onCreateNote()}
				onCreateNotebook={onCreateNotebook}
				onSearch={onSearch}
				onCollapseAll={collapseAll}
				sortBy={sortBy}
				onSortChange={setSortBy}
				searchResults={searchResults}
			/>

			<SidebarFileTree
				notebooks={notebooks}
				notes={notes}
				sortBy={sortBy}
				expandedNotebooks={expandedNotebooks}
				onToggleNotebook={toggleNotebook}
				onCreateNote={onCreateNote}
				onRenameNotebook={onRenameNotebook}
				onDeleteNotebook={onDeleteNotebook}
			/>

			<SidebarFooter user={user} />
		</aside>
	);
}
