---
description: Fetch and format bug reports from Firestore for review
---

# Bug Reports Workflow

Use this workflow when the user asks for bug reports, says "give me bug reports", or uses `/bug-reports`.

## Steps

1. **Fetch bug reports** from the Firestore API:
   ```
   GET http://localhost:3099/api/bugs?status=new
   ```
   If the app isn't running locally, use the production URL:
   ```
   GET https://partypal.social/api/bugs?status=new
   ```

2. **Format each bug** as a structured block with all details:

   For each bug in the response, output it in this format:

   ```
   ### Bug #[id] — [category emoji] [category label]
   - **Page:** [page]
   - **Reported:** [createdAt formatted as date]
   - **Reporter:** [name or "Anonymous"] ([email or "no email"])
   - **Status:** [status]
   - **User Agent:** [first 80 chars of userAgent]

   > **Description:** [description]

   **Ready-to-paste fix prompt:**
   > Fix the issue on the `[page]` page. [description]. Check the relevant components and API routes for this page. The bug was categorized as "[category]".
   ```

3. **Summary table** at the top before individual bugs:

   | # | Category | Page | Description (truncated) | Date |
   |---|----------|------|------------------------|------|
   | 1 | 🐛 Bug   | /dashboard | Event deletion fails... | Mar 2 |

4. **After presenting**, ask the user:
   - "Want me to fix any of these? Just say the bug number."
   - "Want me to mark any as reviewed?"

5. **To mark bugs as reviewed**, use:
   ```
   PATCH http://localhost:3099/api/bugs
   Body: { "id": "<bug-id>", "status": "reviewed" }
   ```

6. **To mark bugs as fixed** after resolving:
   ```
   PATCH http://localhost:3099/api/bugs
   Body: { "id": "<bug-id>", "status": "fixed" }
   ```
