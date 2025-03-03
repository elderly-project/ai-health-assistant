//@ts-ignore
import pdf from 'npm:pdf-parse/lib/pdf-parse.js';

// Function to extract text from PDF buffer
export async function extractTextFromPDF(pdfBuffer: ArrayBuffer): Promise<string> {
    const data = await pdf(pdfBuffer);
    return data.text;
}

// Function to convert text to Markdown
export function convertTextToMarkdown(text: string): string {
    // Simple conversion rules. Enhance these based on your text structure.
    return text
        .replace(/(\b[A-Z][A-Z\s]+\b)/g, '## $1')  // Simple heading detection
        .replace(/\n\s*\n/g, '\n\n');  // Replace multiple new lines with Markdown paragraphs
}

