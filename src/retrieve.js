/**
 * Builds a stable key so repeated retrievals of the same source passage can be fused.
 */
function makeDocumentKey(doc) {
	const metadata = doc.metadata ?? {};

	return [
		metadata.source ?? "",
		metadata.page ?? "",
		metadata.startTime ?? "",
		metadata.endTime ?? "",
		doc.pageContent,
	].join("::");
}

/**
 * Combines the original question and its transformed versions without duplicates.
 */
export function buildQueries(question, transformed) {
	return [
		...new Set(
			[
				question,
				transformed.rewrittenQuery,
				transformed.stepBackQuestion,
				...transformed.subQuestions,
			]
				.map((query) => query.trim())
				.filter(Boolean),
		),
	];
}

/**
 * Searches Qdrant for every query, combines rankings, and returns the best passages.
 */
export async function retrieveEvidence(
	vectorStore,
	queries,
	{ perQuery = 4, maxChunks = 12 } = {},
) {
	const rankedLists = await Promise.all(
		queries.map(async (query) => {
			const results = await vectorStore.similaritySearchWithScore(
				query,
				perQuery,
			);

			return { query, results };
		}),
	);

	const fused = new Map();
	// Merge the ranked results from every query using Reciprocal Rank Fusion.
	// Each result adds 1 / (60 + its zero-based rank + 1) to its document's
	// score. For example, a document ranked 1st and 3rd across two queries gets
	// 1/61 + 1/63. Documents found highly across multiple queries therefore
	// rank higher; the final list is sorted by this score and limited to maxChunks.
	const rrfConstant = 60;

	for (const { query, results } of rankedLists) {
		results.forEach(([doc, score], rankIndex) => {
			const key = makeDocumentKey(doc);

			if (!fused.has(key)) {
				fused.set(key, {
					doc,
					score: 0,
					matchedQueries: [],
					retrievalScores: [],
				});
			}

			const item = fused.get(key);

			// RRF uses rank, not the raw similarity score.
			item.score += 1 / (rrfConstant + rankIndex + 1);

			if (!item.matchedQueries.includes(query)) {
				item.matchedQueries.push(query);
			}

			item.retrievalScores.push({ query, score });
		});
	}

	return [...fused.values()]
		.sort((a, b) => b.score - a.score)
		.slice(0, maxChunks);
}
