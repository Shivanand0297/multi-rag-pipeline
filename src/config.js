import { OpenAIEmbeddings } from "@langchain/openai";
import "dotenv/config";
import OpenAI from "openai";

export const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

export const embeddings = new OpenAIEmbeddings({
	model: "text-embedding-3-small",
});

export const QDRANT_URL = process.env.QDRANT_URL;

export const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION;

if (!process.env.OPENAI_API_KEY) {
	throw new Error("Missing OPENAI_API_KEY in .env");
}
