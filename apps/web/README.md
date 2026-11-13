# apps/web — FieldTwin front-end

Next.js 15 (App Router, TypeScript strict, Tailwind 4), pnpm.

```sh
pnpm install
pnpm dev                                  # http://localhost:3000, mock mode (copies fixtures to public/mock first)
NEXT_PUBLIC_API_MODE=live pnpm dev        # talk to the API at NEXT_PUBLIC_API_BASE (default http://localhost:8000/api/v1)
pnpm test | pnpm lint | pnpm typecheck | pnpm build
pnpm types                                # regenerate lib/api/schema.d.ts from packages/contracts/openapi.yaml
```

- `lib/api/client.ts`: typed functions for every endpoint, plus `assetUrl()`, `fetchAsset()`, `diffImageUrl()`, `isMock`, `ApiError`.
- `lib/api/types.ts`: short names for the generated contract types.
- `lib/decode/heightmap.ts`: decodes a 16-bit PNG into elevations. `lib/decode/ftw1.ts` parses the frame file.
- `/dev/api`: a throwaway check page. Remove it before the demo.

When `isMock` is true, show a **mock** badge. Mock data must never reach the demo.
