import { z } from "zod";

export const createNotebookSchema = z.object({
	name: z.string().min(1, "Notebook name is required").optional(),
});

export const updateNotebookSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1, "Notebook name is required").optional(),
});

export const deleteNotebookSchema = z.object({
	id: z.string().uuid(),
	confirmDelete: z.boolean().optional(),
});

export const restoreNotebookSchema = z.object({
	id: z.string().uuid(),
});

export const permanentDeleteNotebookSchema = z.object({
	id: z.string().uuid(),
});
