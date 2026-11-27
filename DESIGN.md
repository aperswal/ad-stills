# Build plan

Keep the installed vinext starter. The app runs in workerd, with local D1 and R2. A Node runner pulls jobs over REST. The browser gets updates through a small event stream and TanStack Query.

Build the shared schemas and database first. Add the lock and API next. Then connect the runner and screens. Run tests on the boundaries, an end-to-end run with a stand-in, a real Codex run, a build, a dry run, and browser checks. Save the real evidence in HANDOFF.md.

## Risks and decisions

An outsider could guess a passcode, forge a runner, send a bad file, claim an ad twice, or put commands in an image. The deployed app denies access without its secrets. iron-session seals cookies. A D1 counter limits passcode tries by a hashed address. Origin checks protect browser writes. Runner routes compare the token in constant time. Bounded request readers and byte checks protect uploads. All keys come from server IDs. One database statement claims a job; result writes must match its runner and attempt.

A job can outlive a runner or finish after a retry. A claim expires after 15 minutes; an attempt number fences off old results. Inputs stay locked once a batch starts. The runner stops Codex after 10 minutes, checks both outputs, and removes its job folder.

Uploaded words and notes are untrusted content in a JSON block. The prompt separates them from the tool's rules. Codex gets one new folder, attached images, no shell network access, no approvals, and no API keys in its environment. These controls do not prove visual truth: a person still needs to review generated copy and product likeness.

## Plan review

The first design missed late results, upload/start races, and local cross-site writes. Add attempt fencing, a batch upload state with conditional inserts, a single atomic start, and same-origin checks. The local server binds to 127.0.0.1. Deployed mode is the default; local mode also requires a loopback request.

Use the starter's current cf configuration and generated SQL migrations. Avoid extra services, cloud image transforms, global client state, and custom session code. Download all is a local ZIP of completed PNGs and copy. Draft batches remain visible if an upload fails. The form can retry uploads. A complete draft can start from its batch page. An incomplete draft links to a new form.
