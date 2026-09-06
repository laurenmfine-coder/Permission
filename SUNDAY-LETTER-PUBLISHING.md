# Publishing a Sunday Letter issue on laurenfine.com

Run this every time an issue sends. Takes about ten minutes. Four files change.

## 1. Create the issue page

Copy the template and name it after the issue:

    cp sunday-letter-template.html sunday-letter-NN-<kebab-case-title>.html

Slug rules: two-digit issue number, then the headline lowercased, punctuation
stripped, spaces to hyphens. Issue 01 is the worked example:
`sunday-letter-01-the-question-you-havent-said-out-loud-yet.html`

Replace every `{{PLACEHOLDER}}` in the copy:

| Placeholder      | What goes in it                                                        |
|------------------|------------------------------------------------------------------------|
| `{{TITLE}}`      | Headline, plain text, used in title/OG/JSON-LD                          |
| `{{TITLE_HTML}}` | Same headline with `<br>` line breaks and one `<em>` phrase             |
| `{{SLUG}}`       | Filename without `.html`                                                |
| `{{ISSUE_NUM}}`  | `02`, `03`, …                                                           |
| `{{DATE_ISO}}`   | `2026-09-13`                                                            |
| `{{DATE_LONG}}`  | `September 13, 2026`                                                    |
| `{{DEK}}`        | One or two sentences, under 160 characters, used as the meta description |
| `{{READ_MIN}}`   | Word count divided by 200, rounded                                      |
| `{{KEYWORDS}}`   | Four to six comma-separated phrases someone would actually search       |
| `{{BODY}}`       | The letter as `<p>` paragraphs                                          |
| `{{PREV_SLUG}}` `{{PREV_NUM}}` `{{PREV_TITLE}}` | The previous issue, for the back link  |

Then set robots back to indexable:

    <meta name="robots" content="index, follow">

Drop the email furniture from the body. No WHAT TO DO WITH IT box, no
WORTH YOUR TIME block, no unsubscribe footer. It reads as an essay on the web.

## 2. Add it to the archive index

In `sunday-letter.html`, add a new `<a class="sl-issue">` block at the TOP of
`.sl-list`, above the previous issue, matching the existing markup.

In the same file, add a matching entry to the top of the `blogPost` array in
the JSON-LD block in `<head>`.

## 3. Add it to the sitemap

In `sitemap.xml`, add a `<url>` entry with `<loc>` set to the extensionless URL
(`https://laurenfine.com/sunday-letter-NN-...`), `<lastmod>` the send date,
`<changefreq>yearly</changefreq>`, `<priority>0.7</priority>`. Bump the
`<lastmod>` on the `sunday-letter.html` entry to the same date.

## 4. Link it from the letter itself

The Flodesk email should point at `laurenfine.com/sunday-letter` in the bio
block, and Substack posts adapted from the issue should link back to the issue
page. Those two links are where the traffic actually comes from.

## SEO notes

- Every issue page carries canonical, OG, Twitter and BlogPosting JSON-LD.
  Do not strip them.
- Keep at least one in-body link to `resources.html` or `coaching.html`.
  Internal links are what pass authority to the pages that convert.
- Extensionless URLs are the canonical form. `vercel.json` handles the rewrite.
- `sunday-letter-template.html` and `post-template.html` are noindex on purpose.
  If a template ever shows up in Search Console, that meta tag was dropped.
