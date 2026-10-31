import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

const QueryTransformSchema = z.object({
	rewrittenQuery: z.string(),
	subQuestions: z.array(z.string()).min(1).max(4),
	stepBackQuestion: z.string(),
});

const SYSTEM_PROMPT = `
You are a query transformation component for a RAG system.

Return three types of queries:

1. rewrittenQuery:
   Rewrite the original question as a standalone, search-friendly query.
   Preserve its intent, entities, constraints, and important keywords.

2. subQuestions:
   Break the original question into 1-4 focused questions.
   Each should address a distinct information need required to answer it.

3. stepBackQuestion:
   Generalize the question to identify broader concepts, principles,
   processes, or policies that would help answer it.

Rules:
- Do not answer the questions.
- Do not invent facts.
- Do not add unsupported assumptions.
- Keep the queries useful for semantic document retrieval.
- Preserve specific dates, names, and technical terms.
`;

/**
 * Uses an LLM to produce complementary search queries for the user's question.
 */
export async function transformQuery(question) {
	const response = await openai.responses.parse({
		model: "gpt-4.1-mini",
		input: [
			{
				role: "system",
				content: SYSTEM_PROMPT,
			},
			{
				role: "user",
				content: `Original question:\n${question}`,
			},
		],
		text: {
			format: zodTextFormat(QueryTransformSchema, "query_transform"),
		},
	});

	if (!response.output_parsed) {
		throw new Error("The model did not return parsed query transformations.");
	}

	return response.output_parsed;
}
