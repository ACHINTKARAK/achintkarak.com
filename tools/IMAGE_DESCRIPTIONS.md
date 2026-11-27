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
