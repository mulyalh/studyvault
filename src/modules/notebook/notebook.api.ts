import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { dbMiddleware } from "@/shared/middleware/db.middleware";
import { auth } from "@/shared/lib/auth";
import {
	createNotebookSchema,
	updateNotebookSchema,
	deleteNotebookSchema,
	restoreNotebookSchema,
	permanentDeleteNotebookSchema,
} from "./notebook.schema";
import { z } from "zod";

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

export const createNotebookFn = createServerFn({ method: "POST" })
	.middleware([dbMiddleware])
	.inputValidator(createNotebookSchema)
	.handler(async ({ context, data }) => {
		const session = await requireSession();

		const notebook = await context.db.notebook.create({
			data: {
				userId: session.user.id,
				name: data.name || "Untitled Notebook",
			},
		});

		return notebook;
	});

export const updateNotebookFn = createServerFn({ method: "POST" })
	.middleware([dbMiddleware])
	.inputValidator(updateNotebookSchema)
	.handler(async ({ context, data }) => {
		const session = await requireSession();

		const existing = await context.db.notebook.findFirst({
			where: { id: data.id, userId: session.user.id },
		});

		if (!existing) {
			throw new Error("Notebook not found or access denied");
		}

		const updated = await context.db.notebook.update({
			where: { id: data.id },
			data: {
				name: data.name ?? existing.name,
			},
		});

		return updated;
	});

export const deleteNotebookFn = createServerFn({ method: "POST" })
	.middleware([dbMiddleware])
	.inputValidator(deleteNotebookSchema)
	.handler(async ({ context, data }) => {
		const session = await requireSession();

		const existing = await context.db.notebook.findFirst({
			where: { id: data.id, userId: session.user.id },
			include: {
				notes: {
					where: { deletedAt: null },
					select: { id: true },
				},
			},
		});

		if (!existing) {
			throw new Error("Notebook not found or access denied");
		}

		const noteCount = existing.notes.length;

		if (noteCount > 0 && !data.confirmDelete) {
			throw new Error(
				`Folder ini berisi ${noteCount} catatan. Semua catatan akan dipindahkan ke Trash.`,
			);
		}

		if (noteCount > 0) {
			await context.db.note.updateMany({
				where: { notebookId: data.id, deletedAt: null },
				data: { deletedAt: new Date() },
			});
		}

		await context.db.notebook.delete({
			where: { id: data.id },
		});

		return { success: true };
	});

export const restoreNotebookFn = createServerFn({ method: "POST" })
	.middleware([dbMiddleware])
	.inputValidator(restoreNotebookSchema)
	.handler(async ({ context, data }) => {
		const session = await requireSession();

		const existing = await context.db.notebook.findFirst({
			where: { id: data.id, userId: session.user.id },
		});

		if (!existing) {
			throw new Error("Notebook not found or access denied");
		}

		const restored = await context.db.notebook.update({
			where: { id: data.id },
			data: {
				deletedAt: null,
			},
		});

		return restored;
	});

export const permanentDeleteNotebookFn = createServerFn({ method: "POST" })
	.middleware([dbMiddleware])
	.inputValidator(permanentDeleteNotebookSchema)
	.handler(async ({ context, data }) => {
		const session = await requireSession();

		const existing = await context.db.notebook.findFirst({
			where: { id: data.id, userId: session.user.id },
		});

		if (!existing) {
			throw new Error("Notebook not found or access denied");
		}

		await context.db.notebook.delete({
			where: { id: data.id },
		});

		return { success: true };
	});

export const getNotebooksFn = createServerFn({ method: "GET" })
	.middleware([dbMiddleware])
	.handler(async ({ context }) => {
		const session = await requireSession();

		const notebooks = await context.db.notebook.findMany({
			where: {
				userId: session.user.id,
				deletedAt: null,
			},
			include: {
				notes: {
					where: {
						deletedAt: null,
					},
				},
			},
			orderBy: {
				updatedAt: "desc",
			},
		});

		return notebooks;
	});

export const getNotebookByIdFn = createServerFn({ method: "GET" })
	.middleware([dbMiddleware])
	.inputValidator(z.object({ id: z.string().uuid() }))
	.handler(async ({ context, data }) => {
		const session = await requireSession();

		const notebook = await context.db.notebook.findFirst({
			where: {
				id: data.id,
				userId: session.user.id,
			},
			include: {
				notes: {
					where: {
						deletedAt: null,
					},
				},
			},
		});

		return notebook;
	});
