# Multi-RAG Pipeline

This project lets you ask questions about documents and class subtitles. It
searches the documents for relevant passages, then uses those passages to
generate an answer with source references.

## Project flow

There are two separate commands: one prepares the searchable document index,
and the other asks questions against that index.

### 1. Ingest documents

Run:

```bash
pnpm run ingest
```

The ingestion flow:

1. Recursively searches `docs/` and its subfolders for `.pdf`, `.pptx`, `.docx`,
   `.srt`, and `.vtt` files. Other files, such as `.DS_Store`, are ignored.
2. Extracts text from each file. Subtitle files retain source and timing
   metadata where available.
3. Splits long text into chunks (up to 1,000 characters, with 200 characters
   shared between adjacent chunks).
4. Converts each chunk into an embedding, a numeric representation that makes
   meaning-based search possible.
5. Uploads the chunks and their metadata to the Qdrant collection in batches
   of 64.

The index is stored in Qdrant, so querying does not need to read or re-index
the source files.

### 2. Ask a question

Run:

```bash
pnpm run query -- "How does the course explain mobile development?"
```

The query flow:

1. Connects to the existing Qdrant collection.
2. Uses an OpenAI model to make a search-friendly rewrite, focused sub-questions,
   and a broader “step-back” question.
3. Searches Qdrant for the original question and each transformed query.
4. Combines the search rankings, removes repeated results, and keeps up to 12
   passages as evidence.
5. Sends the original question and evidence to the answer model, which returns
   an answer with source filenames and available timestamps or page numbers.

If evidence is insufficient, the answer model is instructed to say so rather
than invent a response.

## Source files

- `src/ingest-cli.js` starts the ingestion command.
- `src/ingest.js` loads documents, splits them into chunks, and indexes them.
- `src/loaders.js` finds files and extracts text and source metadata.
- `src/index.js` is the query command and coordinates retrieval and answer
  generation.
- `src/query-transform.js` creates alternate search queries.
- `src/retrieve.js` searches Qdrant and combines the results.
- `src/config.js` configures OpenAI, embeddings, and Qdrant from environment
  variables.

## Documents

Place documents anywhere under `docs/`. For example:

```text
docs/
  class-subtitle/
    module 1/
      lesson-name/
        lesson-name.srt
        lesson-name.vtt
  reference.pdf
```

Folders are scanned recursively, so the module and lesson folder names do not
need to follow a specific format. Both `.srt` and `.vtt` files are indexed when
both are present. If they contain the same transcript, that content may appear
twice in search results; keeping one format per lesson avoids duplicate
indexing.

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Start Qdrant:

   ```bash
   docker compose up -d
   ```

3. Add these values to `.env`:

   ```dotenv
   OPENAI_API_KEY=your-openai-api-key
   QDRANT_URL=http://localhost:6333
   QDRANT_COLLECTION=your-collection-name
   ```

4. Index documents with `pnpm run ingest`, then ask questions with
   `pnpm run query -- "your question"`.

Run ingestion again after adding or changing source files so the Qdrant index
includes the updated content.
