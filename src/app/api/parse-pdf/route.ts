
import { NextResponse } from 'next/server';
import { storage } from '@/config/firebase'; // Adjust path if needed
import { ref, getBlob } from 'firebase/storage';
import pdf from 'pdf-parse'; // Import pdf-parse

// Configure API route to handle POST requests
// Disable default body parsing, we need the raw request body for some libraries
// export const config = {
//   api: {
//     bodyParser: false,
//   },
// };

// Use POST method for potentially sensitive data like file URLs
export async function POST(request: Request) {
    console.log('[API /api/parse-pdf] Received request');
    try {
        const { url } = await request.json();

        if (!url || typeof url !== 'string') {
            console.error('[API /api/parse-pdf] Invalid URL provided:', url);
            return NextResponse.json({ error: 'Invalid PDF URL provided.' }, { status: 400 });
        }

        // Validate URL format (basic check)
        if (!url.startsWith('https://firebasestorage.googleapis.com/')) {
             console.error('[API /api/parse-pdf] URL is not a Firebase Storage URL:', url);
            return NextResponse.json({ error: 'Invalid or non-Firebase Storage URL.' }, { status: 400 });
        }

         console.log(`[API /api/parse-pdf] Fetching PDF from URL: ${url}`);
        // Create a Firebase Storage reference from the HTTPS URL
        const storageRef = ref(storage, url);

        // Get the PDF file as a Blob
        const pdfBlob = await getBlob(storageRef);
        console.log(`[API /api/parse-pdf] PDF Blob fetched, size: ${pdfBlob.size} bytes`);

        // Convert Blob to Buffer for pdf-parse
        const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer());
         console.log('[API /api/parse-pdf] Converted Blob to Buffer');

        // Parse the PDF buffer
        const data = await pdf(pdfBuffer);
         console.log('[API /api/parse-pdf] PDF parsed successfully.');

        // Return the extracted text
        return NextResponse.json({ text: data.text });

    } catch (error: any) {
        console.error('[API /api/parse-pdf] Error processing PDF:', error);

        // Handle specific errors (e.g., storage not found)
        if (error.code === 'storage/object-not-found') {
            return NextResponse.json({ error: 'PDF not found at the specified URL.' }, { status: 404 });
        }
        if (error.code === 'storage/unauthorized') {
            return NextResponse.json({ error: 'Permission denied to access the PDF file.' }, { status: 403 });
        }

        // Generic server error
        return NextResponse.json({ error: `Failed to parse PDF: ${error.message || 'Unknown error'}` }, { status: 500 });
    }
}
