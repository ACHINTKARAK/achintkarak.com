# Two kinds of text for each photograph

**Alt text** (optional, invisible) accurately describes visible content for screen-reader accessibility and image search. It lives in `alt.json`.

**Author captions** (optional, visible) express Achint's own observation or point of view in a restrained one-liner. They live in `captions.json`. These are separate concepts: do not copy evocative caption text into alt text.

For a new album, use:

```text
journal/YYYY-MM/album-slug/
├── 1.jpg ... 7.jpg
├── description.txt
├── alt.json           (optional: invisible factual descriptions)
└── captions.json      (optional: visible one-line interpretations)
```

The **same caption layout applies automatically to every existing and future album**. To prepare all existing albums locally without overwriting any of your work:

```powershell
cd C:\Achint-Website\journal-engagement-test
git pull
.\journal.ps1 captions -All
```

This creates blank `captions.json` files only where one does not exist. It does **not** make up captions and does not replace Marrakech's captions.

To enter or revise an album's seven observations in PowerShell:

```powershell
.\journal.ps1 captions -Month 2025-12 -Slug dingle-ireland
```

Press Enter to preserve an existing caption; type `/clear` to remove one. Edit the same JSON file directly if you prefer.

For every **new** album, `.\journal.ps1 new -Month YYYY-MM -Slug place-country` now creates `captions.json` and asks for seven captions. Blank entries are fine. If you create an album folder manually rather than using `journal.ps1 new`, the first interactive build will ask for captions when it encounters the new album. Existing albums never trigger repeated build prompts.

To add **visible** captions manually, copy `tools/examples/captions.example.json` into an album folder as `captions.json` and edit the strings. Example only:

```json
{
  "1": "A moment of stillness before the street takes over.",
  "2": "",
  "3": "",
  "4": "",
  "5": "",
  "6": "",
  "7": ""
}
```

Blank or missing entries display **no caption**. Captions are rendered directly beneath their respective photograph in a quiet serif style and are limited to 180 characters each. Use one short, personal, truthful observation: ideally 8–18 words. Avoid explanations that the viewer must accept, invented emotions, tourist slogans, and repetitive captions. Only author final text after looking at the actual photo.

The website keeps exactly seven numbered photographs; `alt.json` continues to work independently. All changes remain in the local test branch until approved.

## Testing

```powershell
cd C:\Achint-Website\journal-engagement-test
git pull
Copy-Item .\tools\examples\captions.example.json .\journal\2026-11\marrakech-morocco\captions.json
notepad .\journal\2026-11\marrakech-morocco\captions.json
.\journal.ps1 check
.\journal.ps1 preview
```

Enter at least one caption to see it displayed. An empty `captions.json` will not produce visible text.

---

# Per-photo descriptions (alt text)

Each album still contains exactly seven numbered photographs and its usual `description.txt`.
For optional *descriptions of the individual photographs*, create one small extra file:

```text
journal/2026-11/marrakech-morocco/
├── 1.jpg ... 7.jpg
├── description.txt
└── alt.json
```

Copy `tools/examples/alt.example.json` into that album as `alt.json`.
Replace the blank strings with descriptions of what is *visibly in that photograph*.
Keep the JSON format valid: double quotes, commas between entries, no comma after the last entry.

Example **only** (hypothetical photo, not a description of a published image):

```json
{
  "1": "A person pauses beneath a stone arch, looking towards a sunlit courtyard.",
  "2": "A narrow street opens onto a busy market, with people moving through the shade."
}
```

You can omit an image or leave its description empty while editing.
The build keeps the existing `Album title — photograph N of 7` fallback.
Nothing is displayed below the photographs: these are HTML `alt` attributes for accessibility and search-image context. Your public seven-image sequence stays exactly as it is.

## Writing rules

- Describe the most important *visible* subject, gesture, light and spatial relationship.
- Favour one straightforward sentence, usually 10–25 words.
- Be specific. Avoid repeated generic phrases and keyword stuffing.
- Don't invent identities, intentions, emotions, or exact locations the photograph does not establish.
- Don't use `photo of` or `image of` unless needed for clarity.
- Caption-like poetry belongs in the album text, not the alt attribute.
- Only publish factual descriptions after reviewing each original image.

## Build and preview

```powershell
.\journal.ps1 check
.\journal.ps1 preview
```

Inspect a photo in browser DevTools. Its `img alt="..."` should use your description.
Your homepage's rotating image will use the same description if the chosen image has one.

## Navigation & engagement

The homepage includes a discreet **Explore this journal** link, and individual album pages name their adjacent albums in the top navigation. A consent-only Google Analytics event, `photo_progress`, reports when photo checkpoints 1, 3, 5 and 7 enter the visible area. This is a *reach* signal, not proof a visitor examined the whole photograph. No event is sent without analytics consent.

To analyse `photo_checkpoint` and `album_path` as dimensions, register them in GA4 Admin → Custom definitions as event-scoped custom dimensions. Search Console indexing is separate from Analytics: verify the domain and submit `https://achintkarak.com/sitemap.xml` there.
