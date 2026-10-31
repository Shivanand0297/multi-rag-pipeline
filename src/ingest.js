import { QdrantVectorStore } from "@langchain/qdrant";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

import { embeddings, QDRANT_COLLECTION, QDRANT_URL } from "./config.js";

import { loadAllDocuments } from "./loaders.js";

const INGEST_BATCH_SIZE = 64;

/**
 * Loads files from docs, splits their text, and stores embedded chunks in Qdrant.
 */
export async function createVectorStore() {
	const documents = await loadAllDocuments();

	console.log(`\nLoaded ${documents.length} document sections`);

	// Split documents into chunks of up to 1,000 characters, with 200 characters of overlap to preserve context.
	const splitter = new RecursiveCharacterTextSplitter({
		chunkSize: 1000,
		chunkOverlap: 200,
	});

	// Split each document into smaller chunks using the configured size and overlap, preserving its metadata.
	const chunks = await splitter.splitDocuments(documents);

	if (chunks.length === 0) {
		throw new Error("No chunks were created.");
	}

	console.log(`Created ${chunks.length} chunks`);
	console.log("Indexing chunks in Qdrant...");

	const vectorStore = new QdrantVectorStore(embeddings, {
		url: QDRANT_URL,
		collectionName: QDRANT_COLLECTION,
	});

	await vectorStore.ensureCollection();

	const totalBatches = Math.ceil(chunks.length / INGEST_BATCH_SIZE);

	// Index chunks in batches, log progress, and add batch context to any indexing errors.
	for (let offset = 0; offset < chunks.length; offset += INGEST_BATCH_SIZE) {
		const batchNumber = Math.floor(offset / INGEST_BATCH_SIZE) + 1;
		const batch = chunks.slice(offset, offset + INGEST_BATCH_SIZE);

		console.log(
			`Indexing batch ${batchNumber}/${totalBatches} (${batch.length} chunks)...`,
		);

		try {
			await vectorStore.addDocuments(batch);
		} catch (error) {
			throw new Error(
				`Failed to index batch ${batchNumber}/${totalBatches}: ${error.message}`,
				{ cause: error },
			);
		}
	}

	console.log("Qdrant indexing completed.");

	return vectorStore;
}
