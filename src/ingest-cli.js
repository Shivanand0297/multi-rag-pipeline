import "dotenv/config";

import { createVectorStore } from "./ingest.js";

// Start the indexing flow and make ingestion failures visible to the shell.
createVectorStore().catch((error) => {
	console.error("\nDocument ingestion failed:", error);
	process.exitCode = 1;
});
