<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Portal PINs are verified in the database (redeem_portal_pin RPC against bcrypt hashes in portal_pins); never put PINs or service keys in app code or env — keeps the app deployable with only the public URL + publishable key.
- The root content gate checks backend-issued roles; restrictive listing RLS enforces portal access independently of React.
- Posting creates profiles with the shared browser device identifier; database uniqueness and immutable-device triggers prevent reuse or removal, without fingerprinting physical devices.
- Admin post edits use ordinary authenticated client updates under existing admin RLS, preserving owner and approval status.
