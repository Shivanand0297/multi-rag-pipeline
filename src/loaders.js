import fs from "node:fs/promises";
import path from "node:path";

import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { PPTXLoader } from "@langchain/community/document_loaders/fs/pptx";
import { SRTLoader } from "@langchain/community/document_loaders/fs/srt";
import { Document } from "@langchain/core/documents";

import webvttParser from "webvtt-parser";

/**
 * Adds a relative source path and file type to each loaded document section.
 */
function addSourceMetadata(documents, source, extension) {
	return documents.map(
		(doc) =>
			new Document({
				pageContent: doc.pageContent,
				metadata: {
					...doc.metadata,
					source,
					fileType: extension.slice(1),
				},
			}),
	);
}

/**
 * Parses a WebVTT subtitle file into one document per non-empty cue.
 */
async function loadVtt(filePath, source) {
	const raw = await fs.readFile(filePath, "utf8");
	const parser = new webvttParser.WebVTTParser();

	const tree = parser.parse(raw.replace(/^\uFEFF/, ""), "metadata");

	return (tree.cues ?? [])
		.filter((cue) => cue.text?.trim())
		.map((cue, index) => {
			// Remove common inline cue markup but preserve the text.
			const text = cue.text
				.replace(/<[^>]*>/g, "")
				.replace(/\s+/g, " ")
				.trim();

			return new Document({
				pageContent: text,
				metadata: {
					source,
					fileType: "vtt",
					cueIndex: index,
					startTime: cue.startTime,
					endTime: cue.endTime,
				},
			});
		})
		.filter((doc) => doc.pageContent.length > 0);
}

/**
 * Loads one supported file with its format-specific parser.
 */
export async function loadFile(filePath, source = path.basename(filePath)) {
	const extension = path.extname(filePath).toLowerCase();

	let documents;

	switch (extension) {
		case ".pdf":
			documents = await new PDFLoader(filePath).load();
			break;

		case ".pptx":
			{
				documents = await new PPTXLoader(filePath).load();
			}
			break;

		case ".docx":
			documents = await new DocxLoader(filePath).load();
			break;

		case ".srt":
			documents = await new SRTLoader(filePath).load();
			break;

		case ".vtt":
			return loadVtt(filePath, source);

		default:
			return [];
	}

	return addSourceMetadata(documents, source, extension);
}

/**
 * Recursively finds supported files below a directory.
 */
async function findSupportedFiles(directory, supportedExtensions) {
	const entries = await fs.readdir(directory, {
		withFileTypes: true,
	});
	const files = [];

	for (const entry of entries) {
		const filePath = path.join(directory, entry.name);

		if (entry.isDirectory()) {
			files.push(...(await findSupportedFiles(filePath, supportedExtensions)));
		} else if (
			entry.isFile() &&
			supportedExtensions.has(path.extname(entry.name).toLowerCase())
		) {
			files.push(filePath);
		}
	}

	return files;
}

/**
 * Loads all supported files below docsDir and combines their sections.
 */
export async function loadAllDocuments(docsDir = "./docs") {
	const supportedExtensions = new Set([
		".pdf",
		".pptx",
		".docx",
		".srt",
		".vtt",
	]);
	const files = await findSupportedFiles(docsDir, supportedExtensions);

	if (files.length === 0) {
		throw new Error(`No supported files found in ${docsDir}`);
	}

	const documents = [];

	for (const filePath of files) {
		const source = path.relative(docsDir, filePath).split(path.sep).join("/");
		console.log(`Loading: ${source}`);
		try {
			//Loads one supported file with its format-specific parser.
			const loaded = await loadFile(filePath, source);

			if (loaded.length === 0) {
				console.warn(`No text extracted from ${source}`);
				continue;
			}

			documents.push(...loaded);
			console.log(`Extracted ${loaded.length} sections`);
		} catch (error) {
			throw new Error(`Failed to load ${source}: ${error.message}`, {
				cause: error,
			});
		}
	}

	if (documents.length === 0) {
		throw new Error("No text could be extracted from the files.");
	}

	return documents;
}
