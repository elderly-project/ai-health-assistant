//@ts-ignore
import JSZip from 'npm:jszip';

// Function to extract text from a DOCX buffer
export async function extractTextFromDOCX(docxBuffer: ArrayBuffer): Promise<string> {
    const zip = await JSZip.loadAsync(docxBuffer);
    let extractedText = '';

    // Check for the document.xml file that contains the main document content
    const documentFile = zip.files['word/document.xml'];

    if (documentFile) {
        const documentContent = await documentFile.async('string');

        // Extract text content from the document's XML data
        const texts = documentContent.match(/<w:t[^>]*>(.*?)<\/w:t>/g) || [];
        texts.forEach((text: string) => {
            extractedText += text.replace(/<\/?w:t[^>]*>/g, '') + '\n';
        });
    }

    return extractedText;
}

// Function to convert text to Markdown (optional, for formatting)
export function convertTextWordToMarkdown(text: string): string {
    return text
        .replace(/(\b[A-Z][A-Z\s]+\b)/g, '## $1')  // Simple heading detection
        .replace(/\n\s*\n/g, '\n\n');  // Replace multiple new lines with Markdown paragraphs
}


