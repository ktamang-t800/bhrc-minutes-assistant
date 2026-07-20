# BHRC Minutes Assistant

A standalone, passcode-protected web chatbot for five public Budget, Human
Resources and Compensation Committee meeting-minute PDFs.

The repository includes two independent deployment surfaces:

- The original vinext app used for the existing `chatgpt.site` deployment
- A separate Streamlit app at `streamlit_app.py` for office networks that allow
  `streamlit.app`

## What it does

- Answers strictly from the five supplied PDF documents
- Streams conversational answers
- Adds exact meeting and page citations
- Opens cited PDF pages directly
- Refuses to guess when the documents do not contain the answer
- Uses a shared passcode without individual accounts
- Works on desktop and mobile browsers

## Private local configuration

The OpenAI key and shared passcode are never committed to the project.

Run:

```bash
bash scripts/configure-local.sh
```

The setup asks for the OpenAI key with hidden input and can generate a strong
shared passcode. It writes the values to the ignored `.dev.vars` file.

## Local development

```bash
pnpm install
pnpm run dev
```

Open `http://localhost:3000`.

### Streamlit version

Create `.streamlit/secrets.toml` from the included example, then run:

```bash
python3 -m pip install -r requirements.txt
streamlit run streamlit_app.py
```

For Streamlit Community Cloud, add the same three values through the app's
Secrets settings instead of committing `secrets.toml`.

## Validation

```bash
pnpm run build
pnpm exec tsc --noEmit
pnpm run lint
node --test tests/rendered-html.test.mjs
```

## Updating source documents

Place replacement PDFs in a source directory using the expected filenames,
then regenerate the page-level corpus and public PDF copies:

```bash
python3 scripts/extract_documents.py /path/to/source-pdfs "$PWD"
```

The first version is intentionally optimized for five documents. If the library
grows substantially, replace the all-document context with indexed retrieval.
