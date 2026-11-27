# Ad Stills

Remake photo ads for your own product. Add reference ads, product photos, and a few words about your business.

## You need

Node 24.18 or newer, pnpm 10.27, and Codex CLI 0.167 or newer. Codex needs your own ChatGPT sign-in and access to image generation. No AI API key is used.

## Run on your computer

```sh
pnpm install
pnpm run setup
codex login
pnpm dev
```

Open http://127.0.0.1:3000. The app and runner start together. No Cloudflare account is needed. If Codex is already signed in, skip its login command.

Use `pnpm run setup`, with `run`: `pnpm setup` is pnpm's own shell setup command. The app setup makes fresh local secrets and applies the database migrations. Running it again keeps your secrets and data.

Choose **New batch**. Add 1–10 reference ads and 1–10 product photos. Use PNG, JPEG, or WebP, up to 10 MB each. Fill in your brand, problem, customer, and solution. Choose **Make the ads**.

Keep the terminal open. Two ads run at once. An ad can take 3–5 minutes. A run stops after 10 minutes. Download each result or all finished ads as a ZIP. **Make again** accepts a short change note.

Local files and the database stay in `.local/state`. Job folders stay in `.local/jobs` and are removed after each attempt. `.dev.vars` holds local settings. These paths are ignored by Git. The app listens only on this computer.

## Runner settings

Change `RUNNER_CONCURRENCY` in `.dev.vars` to a number from 1 to 8. The default is 2. `CODEX_BIN` defaults to `codex`.

For a deployed app, copy `.runner.vars.example` to `.runner.vars`. Set `APP_URL` to your HTTPS app address and `RUNNER_TOKEN` to the same secret as the Worker. Remove optional empty lines to use the defaults. Then run:

```sh
pnpm runner
```

The app shows `pnpm dev`, `pnpm runner`, or `codex login` when setup needs attention. The runner only accepts a ChatGPT login; an API-key login does not count.

## Deploy to your Cloudflare account

These commands publish to your own account. Local use does not need them. The `pnpm cf` helper keeps Cloudflare's sign-in and settings inside this folder.

```sh
pnpm cf auth login
pnpm cf d1 create --name ad-stills
pnpm cf r2 buckets create --name ad-stills-files
```

Copy `.deploy.vars.example` to `.deploy.vars` and set `D1_DATABASE_ID` to the `uuid` the second command printed. Git ignores that file, so your account's ID stays on your computer. Then create the tables:

```sh
pnpm cf d1 migrations apply YOUR_DATABASE_ID --dir migrations
```

The app stays closed until it has three secrets, and a new Worker needs them on its first deploy. Create `.local/deploy-secrets.env` in your editor. Git ignores that folder. Never share the file.

```
APP_PASSCODE=a passcode of at least 12 characters, which you type to open the app
SESSION_SECRET=at least 32 random characters
RUNNER_TOKEN=at least 32 random characters
```

`openssl rand -hex 32` prints a good random value. Then build and deploy:

```sh
pnpm build
pnpm cf deploy --prebuilt --secrets-file .local/deploy-secrets.env
```

The last lines print your app's address. Later deploys need only `pnpm build` and `pnpm run deploy`. To change the passcode later, run `pnpm cf workers secrets update APP_PASSCODE --worker ad-stills`.

Now point the runner at it. Copy `.runner.vars.example` to `.runner.vars`, set `APP_URL` to your app's address and `RUNNER_TOKEN` to the same value as above, remove the empty lines, and run `pnpm runner`. Open the app, type your passcode, and make a batch. The pictures are still drawn on your computer.

Keep the R2 bucket private. Cloudflare may charge for storage and requests beyond its free limits.

## Ad rules

Keep the reference ad's layout, shot, lighting, type order, hook structure, and shape. Replace its product, words, brand, colours, and people.

Never include another company's brand, logo, mascot, watermark, or product. Never invent prices, discounts, reviews, star ratings, awards, guarantees, or health and body claims. Only use facts you supplied. Codex is told these rules. Review every result for truth, product likeness, and rights before you use it.

## Checks

```sh
pnpm verify
pnpm build
pnpm deploy:dry
```

`deploy:dry` builds nothing and publishes nothing; run `build` first. To repeat the full local proof, start `pnpm dev:app` in one terminal, then run `pnpm proof:mock` in another. It makes fictional images and runs the full loop with a stand-in. `pnpm proof:browser` checks all screens in installed Chrome at phone and desktop sizes.

`pnpm proof:real` does the same with the real Codex CLI and one fictional ad. It needs your Codex sign-in and takes a few minutes.
