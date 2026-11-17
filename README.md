# Sol sostenido ♯

Un mural sonoro de apoyo entre universidades del Perú. La web está en esta carpeta (Next.js) y la API de mensajes
en `infra/worker` (Cloudflare Workers + D1); su README explica el deploy y la moderación.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## Cambiar la clave de aprobación

Con la clave correcta, un mensaje se publica sin revisión. Para cambiarla, desde `infra/worker`:

```bash
pnpm wrangler secret put CODIGO_APROBACION
```

Pide el valor nuevo (no se ve mientras se escribe). Se aplica al instante, sin volver a desplegar, y la clave anterior
deja de funcionar.

- Que sea larga y difícil de adivinar, por ejemplo varias palabras unidas: una de dos números se adivina probando.
- No guardarla en ningún archivo del proyecto ni compartirla en grupos: solo con quien apruebe mensajes.
- En local, el Worker lee la clave de `infra/worker/.dev.vars` (no se sube a git).

## Borrar un mensaje del mural

Desde esta carpeta, copiando el texto del mensaje (no importan las mayúsculas, los espacios ni los saltos de línea):

```bash
pnpm borrar "Marce ctmr"                  # muestra qué mensajes tienen ese texto, sin borrar nada
pnpm borrar "Marce ctmr" --si             # los borra
pnpm borrar "Fernet" --contiene           # busca por un pedazo del mensaje
pnpm borrar "Fernet" --contiene --si      # y lo borra
```

Sin `--contiene`, el texto tiene que ser el mensaje completo. Con `--contiene` conviene revisar la lista antes de
agregar `--si`, porque un pedazo corto puede coincidir con varios mensajes.

El mensaje desaparece del mural al recargar la página.
