# Kids Practice

Interactive first-grade practice for kids with a large handwriting board, instant answer checking, tracing guidance, and pop-up feedback.

## What It Includes

- Addition and subtraction within 100
- Multiplication up to 11
- Uppercase and lowercase A-Z tracing with guided stroke order
- One large handwriting box for writing the full answer
- Handwritten digit recognition tuned for child-friendly input
- Query-string page links: `?page=math` and `?page=letters`
- Cute eraser and magnifier actions
- GitHub Pages deployment

## Run Locally

Install Node.js, then start the local preview server:

```bash
npm start
```

Open:

```text
http://127.0.0.1:3000/?page=math
```

Letters page:

```text
http://127.0.0.1:3000/?page=letters
```

For auto-reload during local development:

```bash
npm run dev
```

## Project Structure

- `public/` contains the website files and handwriting model assets
- `server.js` serves the static site locally
- `.github/workflows/pages.yml` deploys the site to GitHub Pages

## Live Site

[https://jakezheng.github.io/kids-math-practice/](https://jakezheng.github.io/kids-math-practice/)
