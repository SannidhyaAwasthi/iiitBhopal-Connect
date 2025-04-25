# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Troubleshooting

### Failed to load chunk errors

If you encounter errors like `Error: Failed to load chunk /_next/static/chunks/...` during development, especially when using Turbopack (`next dev --turbopack`), try the following steps:

1.  **Restart the Development Server:** Stop the current `next dev` process (Ctrl+C in the terminal) and start it again (`npm run dev` or `yarn dev`).
2.  **Clear the `.next` directory:** Stop the development server, delete the `.next` folder in your project's root directory, and then restart the development server. This forces a complete rebuild.
3.  **Clear Browser Cache:** Perform a hard refresh in your browser (Ctrl+Shift+R or Cmd+Shift+R) or clear the browser's cache for `localhost`.
4.  **Try without Turbopack:** Temporarily remove the `--turbopack` flag from the `dev` script in your `package.json` and run the development server again. This can help determine if the issue is specific to Turbopack.
    ```json
    // Example package.json change:
    "scripts": {
      "dev": "next dev -p 9002", // Removed --turbopack
      // ... other scripts
    },
    ```
    Remember to add the flag back later if needed.
5.  **Check Dependencies:** Ensure all dependencies are installed correctly by running `npm install` or `yarn install`. Check for any warnings during the installation process.

These steps often resolve temporary build inconsistencies or caching issues that lead to chunk loading errors.
